import { sql } from "@/lib/db";
import { escapeHtml, PermanentEmailError, sendEmail } from "@/lib/email";
import { SITE_NAME, SITE_URL, STATUS_LABELS } from "@/lib/config";
import { withRun } from "./run";

interface MatchRow {
  user_id: string;
  email: string;
  event_id: number;
  csc: string;
  name: string;
  event_type: string;
  detail: Record<string, unknown>;
}

interface DropRow {
  user_id: string;
  email: string;
  event_id: number;
  detail: Record<string, unknown>;
}

/**
 * Only events this recent are eligible. Anything older is history, not an
 * alert (e.g. after an outage). Dedupe is by alert_deliveries, not by time.
 */
const LOOKBACK = "48 hours";
const MAX_ITEMS_PER_EMAIL = 50;
/** Tags email clicks so the admin dashboard counts them as Email traffic. */
const UTM = "utm_source=email&amp;utm_medium=alert";

/**
 * Digest: one email per user per run with their undelivered watchlist events,
 * plus one email per opted-in user for undelivered allocated-drop events.
 *
 * Every (user, event) pair actually sent is recorded in alert_deliveries, so a
 * run that fails partway through never re-sends to users it already reached,
 * and one bad recipient doesn't block everyone else.
 */
export async function runDigestJob() {
  return withRun("digest", async () => {
    const matches = await sql<MatchRow[]>`
      select w.user_id, u.email, e.id as event_id, e.csc, p.name, e.event_type, e.detail
      from inventory_events e
      join products p using (csc)
      join watchlist w using (csc)
      join auth.users u on u.id = w.user_id
      left join alert_prefs ap on ap.user_id = w.user_id
      where e.created_at > now() - ${LOOKBACK}::interval
        and e.created_at >= w.created_at
        and e.event_type <> 'allocated_drop'
        and (
          e.event_type <> 'store_restock'
          or exists (
            select 1 from user_stores us
            where us.user_id = w.user_id
              and us.store_id = (e.detail->>'store_id')::int
          )
        )
        and coalesce(ap.watchlist_email, true)
        and u.email is not null
        and not exists (
          select 1 from alert_deliveries d
          where d.user_id = w.user_id and d.event_id = e.id
        )
      order by u.email, e.created_at`;

    const drops = await sql<DropRow[]>`
      select ap.user_id, u.email, e.id as event_id, e.detail
      from inventory_events e
      cross join alert_prefs ap
      join auth.users u on u.id = ap.user_id
      where e.event_type = 'allocated_drop'
        and e.created_at > now() - ${LOOKBACK}::interval
        and ap.allocated_email
        and u.email is not null
        and not exists (
          select 1 from alert_deliveries d
          where d.user_id = ap.user_id and d.event_id = e.id
        )
      order by u.email, e.created_at`;

    const errors: string[] = [];
    const skipped: string[] = [];

    let digestsSent = 0;
    for (const rows of groupByUser(matches)) {
      const { user_id, email } = rows[0];
      const eventIds = rows.map((r) => r.event_id);
      const ok = await deliver(errors, skipped, user_id, eventIds, {
        to: email,
        subject: `${SITE_NAME}: ${rows.length} update${rows.length === 1 ? "" : "s"} on your watchlist`,
        html: digestHtml(rows),
        idempotencyKey: `digest/${user_id}/${Math.max(...eventIds)}`,
      });
      if (ok) digestsSent++;
    }

    let dropAlertsSent = 0;
    for (const rows of groupByUser(drops)) {
      const { user_id, email } = rows[0];
      const eventIds = rows.map((r) => r.event_id);
      const products = rows.flatMap((r) => (r.detail.products as string[]) ?? []);
      const ok = await deliver(errors, skipped, user_id, eventIds, {
        to: email,
        subject: `${SITE_NAME}: the allocated list just posted`,
        html: dropHtml(products),
        idempotencyKey: `drop/${user_id}/${Math.max(...eventIds)}`,
      });
      if (ok) dropAlertsSent++;
    }

    const result = {
      matched_events: matches.length,
      digests_sent: digestsSent,
      drop_alerts_sent: dropAlertsSent,
      failed: errors.length,
      errors: errors.slice(0, 20),
      skipped_permanent: skipped.slice(0, 20),
    };
    // Permanent per-recipient failures (bad address) are recorded and skipped.
    // Transient failures are retried next run (nothing was recorded for them);
    // if every transient-eligible send failed, the problem is systemic (API
    // key, rate limit, outage) — fail the run loudly.
    const attempted = errors.length + digestsSent + dropAlertsSent;
    if (errors.length > 0 && errors.length === attempted) {
      throw new Error(`digest: ${errors.length} send(s) failed: ${errors.slice(0, 5).join("; ")}`);
    }
    return result;
  });
}

async function deliver(
  errors: string[],
  skipped: string[],
  userId: string,
  eventIds: number[],
  email: Parameters<typeof sendEmail>[0]
): Promise<boolean> {
  try {
    await sendEmail(email);
  } catch (err) {
    const message = `${email.to}: ${err instanceof Error ? err.message : String(err)}`;
    if (!(err instanceof PermanentEmailError)) {
      errors.push(message);
      return false;
    }
    // Retrying won't help — mark these events handled for this user.
    skipped.push(message);
    await recordDeliveries(userId, eventIds);
    return false;
  }
  await recordDeliveries(userId, eventIds);
  return true;
}

async function recordDeliveries(userId: string, eventIds: number[]) {
  await sql`
    insert into alert_deliveries (user_id, event_id)
    select ${userId}::uuid, unnest(${eventIds}::bigint[])
    on conflict do nothing`;
}

function groupByUser<T extends { user_id: string }>(rows: T[]): T[][] {
  const byUser = new Map<string, T[]>();
  for (const row of rows) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }
  return [...byUser.values()];
}

function digestHtml(rows: MatchRow[]): string {
  const shown = rows.slice(0, MAX_ITEMS_PER_EMAIL);
  const items = shown
    .map((r) => {
      const d = r.detail ?? {};
      let line = "";
      switch (r.event_type) {
        case "restock":
          line = `<strong>Back in stock</strong> — ${escapeHtml(d.qty ?? "?")} bottles statewide`;
          break;
        case "store_restock":
          line = `<strong>Back at ${escapeHtml(d.store_name)}</strong>${d.city ? ` (${escapeHtml(d.city)})` : ""} — ${escapeHtml(d.qty ?? "?")} bottle${d.qty === 1 ? "" : "s"}`;
          break;
        case "out_of_stock":
          line = `<strong>Out of stock</strong> statewide`;
          break;
        case "price_change":
          line = `<strong>Price change</strong> — $${escapeHtml(d.old)} → $${escapeHtml(d.new)}`;
          break;
        case "status_change":
          line = `<strong>Status change</strong> — ${escapeHtml(STATUS_LABELS[String(d.old)] ?? d.old)} → ${escapeHtml(STATUS_LABELS[String(d.new)] ?? d.new)}`;
          break;
        default:
          line = `<strong>${escapeHtml(r.event_type)}</strong>`;
      }
      return `<li style="margin-bottom:8px"><a href="${SITE_URL}/product/${encodeURIComponent(r.csc)}?${UTM}">${escapeHtml(r.name)}</a><br/>${line}</li>`;
    })
    .join("");
  const more =
    rows.length > shown.length
      ? `<p>…and ${rows.length - shown.length} more. <a href="${SITE_URL}/watchlist?${UTM}">See your watchlist</a></p>`
      : "";
  return `
    <div style="font-family:sans-serif;max-width:560px">
      <h2>Your watchlist has updates</h2>
      <ul>${items}</ul>
      ${more}
      <p style="color:#777;font-size:12px">Inventory data scraped from public Utah DABS pages.
      Not affiliated with Utah DABS. Always confirm availability with the store.
      <a href="${SITE_URL}/watchlist?${UTM}">Manage alerts</a></p>
    </div>`;
}

function dropHtml(products: string[]): string {
  const items = products.slice(0, 50).map((p) => `<li>${escapeHtml(p)}</li>`).join("");
  return `
    <div style="font-family:sans-serif;max-width:560px">
      <h2>The allocated &amp; rare list just posted</h2>
      <ul>${items}</ul>
      <p><a href="${SITE_URL}/drops?${UTM}">See stores and quantities →</a></p>
      <p style="color:#777;font-size:12px">Posted quantities are beginning quantities, not live counts.
      Not affiliated with Utah DABS. <a href="${SITE_URL}/watchlist?${UTM}">Manage alerts</a></p>
    </div>`;
}
