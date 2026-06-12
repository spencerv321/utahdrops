import { sql } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { SITE_NAME, SITE_URL, STATUS_LABELS } from "@/lib/config";
import { withRun, lastSuccessfulRun } from "./run";

interface MatchRow {
  email: string;
  csc: string;
  name: string;
  event_type: string;
  detail: Record<string, unknown>;
}

interface DropAlertUser {
  email: string;
}

/**
 * Hourly digest: watchlist-matched events since the last successful digest,
 * one email per user max (the PRD's 1/user/hour cap falls out of the cadence).
 * Allocated-drop events go to all opted-in users immediately in the same run.
 */
export async function runDigestJob() {
  return withRun("digest", async () => {
    const since = (await lastSuccessfulRun("digest")) ?? new Date(Date.now() - 3600_000);

    const matches = await sql<MatchRow[]>`
      select u.email, e.csc, p.name, e.event_type, e.detail
      from inventory_events e
      join products p using (csc)
      join watchlist w using (csc)
      join auth.users u on u.id = w.user_id
      left join alert_prefs ap on ap.user_id = w.user_id
      where e.created_at > ${since}
        and coalesce(ap.watchlist_email, true)
        and u.email is not null
      order by u.email, e.created_at`;

    const byUser = new Map<string, MatchRow[]>();
    for (const m of matches) {
      const list = byUser.get(m.email) ?? [];
      list.push(m);
      byUser.set(m.email, list);
    }

    let digestsSent = 0;
    for (const [email, rows] of byUser) {
      await sendEmail({
        to: email,
        subject: `${SITE_NAME}: ${rows.length} update${rows.length === 1 ? "" : "s"} on your watchlist`,
        html: digestHtml(rows),
      });
      digestsSent++;
    }

    // Allocated drops: immediate, separate opt-in
    const dropEvents = await sql<{ detail: Record<string, unknown> }[]>`
      select detail from inventory_events
      where event_type = 'allocated_drop' and created_at > ${since}`;

    let dropAlertsSent = 0;
    if (dropEvents.length > 0) {
      const users = await sql<DropAlertUser[]>`
        select u.email from alert_prefs ap
        join auth.users u on u.id = ap.user_id
        where ap.allocated_email and u.email is not null`;
      const products = dropEvents.flatMap((e) => (e.detail.products as string[]) ?? []);
      for (const { email } of users) {
        await sendEmail({
          to: email,
          subject: `${SITE_NAME}: the allocated list just posted`,
          html: dropHtml(products),
        });
        dropAlertsSent++;
      }
    }

    return { matched_events: matches.length, digests_sent: digestsSent, drop_alerts_sent: dropAlertsSent };
  });
}

function digestHtml(rows: MatchRow[]): string {
  const items = rows
    .map((r) => {
      const d = r.detail ?? {};
      let line = "";
      switch (r.event_type) {
        case "restock":
          line = `<strong>Back in stock</strong> — ${d.qty ?? "?"} bottles statewide`;
          break;
        case "out_of_stock":
          line = `<strong>Out of stock</strong> statewide`;
          break;
        case "price_change":
          line = `<strong>Price change</strong> — $${d.old} → $${d.new}`;
          break;
        case "status_change":
          line = `<strong>Status change</strong> — ${STATUS_LABELS[String(d.old)] ?? d.old} → ${STATUS_LABELS[String(d.new)] ?? d.new}`;
          break;
        default:
          line = `<strong>${r.event_type}</strong>`;
      }
      return `<li style="margin-bottom:8px"><a href="${SITE_URL}/product/${r.csc}">${r.name}</a><br/>${line}</li>`;
    })
    .join("");
  return `
    <div style="font-family:sans-serif;max-width:560px">
      <h2>Your watchlist has updates</h2>
      <ul>${items}</ul>
      <p style="color:#777;font-size:12px">Inventory data scraped from public Utah DABS pages.
      Not affiliated with Utah DABS. Always confirm availability with the store.
      <a href="${SITE_URL}/watchlist">Manage alerts</a></p>
    </div>`;
}

function dropHtml(products: string[]): string {
  const items = products.slice(0, 50).map((p) => `<li>${p}</li>`).join("");
  return `
    <div style="font-family:sans-serif;max-width:560px">
      <h2>The allocated &amp; rare list just posted</h2>
      <ul>${items}</ul>
      <p><a href="${SITE_URL}/drops">See stores and quantities →</a></p>
      <p style="color:#777;font-size:12px">Posted quantities are beginning quantities, not live counts.
      Not affiliated with Utah DABS. <a href="${SITE_URL}/watchlist">Manage alerts</a></p>
    </div>`;
}
