import { createHash } from "node:crypto";
import { sql } from "@/lib/db";
import { escapeHtml, PermanentEmailError, sendEmail } from "@/lib/email";
import { DABS_RHDP_URL, SITE_NAME, SITE_URL } from "@/lib/config";
import { drawingTitle, getDrawings, type Drawing } from "@/lib/drawings";
import { alertKindsFor, closeLabel, kindsToSend, type DrawingAlertKind, type LiveDrawing } from "@/lib/drawing-alerts";
import { withRun } from "./run";

/** Only drawings the rhdp job saw this recently count as live (no alerts off stale data). */
const LIVE_WITHIN = "12 hours";
/** Keeps one run inside the function's time limit; the rest go next run. */
const MAX_SENDS_PER_RUN = 300;
const UTM = "utm_source=email&amp;utm_medium=drawing";

interface Recipient {
  user_id: string;
  email: string;
  sent: string[];
}

/**
 * Emails people with drawing alerts on about open and upcoming DABS drawings.
 * Runs after each rhdp pass (and can run alone). Every send is recorded in
 * drawing_alert_deliveries, so a later run never repeats an email, and one
 * bad address doesn't block the rest.
 */
export async function runDrawingAlertsJob(now = new Date()) {
  return withRun("drawing_alerts", async () => {
    const live = await sql<{ drawing: string; section: "future" | "current"; closes_at: Date | null }[]>`
      select d.drawing,
             case when bool_or(d.section = 'current') then 'current' else 'future' end as section,
             w.closes_at
      from rhdp_drawings d
      left join rhdp_drawing_windows w using (drawing)
      where d.section in ('future', 'current')
        and d.last_seen > now() - ${LIVE_WITHIN}::interval
      group by d.drawing, w.closes_at`;
    if (live.length === 0) return { live: 0, sent: 0 };

    const details = new Map((await getDrawings()).map((d) => [d.name, d]));
    const errors: string[] = [];
    const skipped: string[] = [];
    const sentByKind: Record<string, number> = {};
    let sent = 0;
    let deferred = 0;

    for (const row of live) {
      const d: LiveDrawing = { drawing: row.drawing, section: row.section, closesAt: row.closes_at };
      const due = alertKindsFor(d, now);
      if (due.length === 0) continue;

      const recipients = await sql<Recipient[]>`
        select ap.user_id, u.email,
               coalesce(array_agg(x.kind) filter (where x.kind is not null), '{}') as sent
        from alert_prefs ap
        join auth.users u on u.id = ap.user_id
        left join drawing_alert_deliveries x on x.user_id = ap.user_id and x.drawing = ${row.drawing}
        where ap.drawing_email and u.email is not null
        group by ap.user_id, u.email
        order by u.email`;

      for (const r of recipients) {
        const kinds = kindsToSend(due, r.sent);
        if (kinds.length === 0) continue;
        if (sent + errors.length + skipped.length >= MAX_SENDS_PER_RUN) {
          deferred++;
          continue;
        }
        const email = drawingEmail(d, kinds[0], details.get(row.drawing));
        try {
          await sendEmail({
            to: r.email,
            subject: email.subject,
            html: email.html,
            idempotencyKey: `drawing/${r.user_id}/${shortHash(row.drawing)}/${kinds.join("+")}`,
          });
        } catch (err) {
          const message = `${r.email}: ${err instanceof Error ? err.message : String(err)}`;
          // Transient failures retry next run; a bad address is marked handled.
          if (!(err instanceof PermanentEmailError)) {
            errors.push(message);
            continue;
          }
          skipped.push(message);
          await recordDeliveries(r.user_id, row.drawing, kinds);
          continue;
        }
        await recordDeliveries(r.user_id, row.drawing, kinds);
        sent++;
        sentByKind[kinds[0]] = (sentByKind[kinds[0]] ?? 0) + 1;
      }
    }

    const result = {
      live: live.length,
      sent,
      by_kind: sentByKind,
      deferred_to_next_run: deferred,
      failed: errors.length,
      errors: errors.slice(0, 10),
      skipped_permanent: skipped.slice(0, 10),
    };
    // Every send failing means the problem is systemic (key, quota, outage): fail loudly.
    if (errors.length > 0 && sent === 0) {
      throw new Error(`drawing alerts: ${errors.length} send(s) failed: ${errors.slice(0, 5).join("; ")}`);
    }
    return result;
  });
}

async function recordDeliveries(userId: string, drawing: string, kinds: DrawingAlertKind[]) {
  await sql`
    insert into drawing_alert_deliveries (user_id, drawing, kind)
    select ${userId}::uuid, ${drawing}, unnest(${kinds}::text[])
    on conflict do nothing`;
}

function shortHash(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 12);
}

const n = (v: number) => v.toLocaleString("en-US");

/** Subject and body for one person's email about one drawing, headed by `kind`. */
export function drawingEmail(d: LiveDrawing, kind: DrawingAlertKind, detail: Drawing | undefined) {
  const title = drawingTitle(d.drawing);
  const closes = d.closesAt ? closeLabel(d.closesAt) : null;
  const subject =
    kind === "closing"
      ? `${SITE_NAME}: the ${title} drawing closes ${closes}`
      : kind === "open"
        ? `${SITE_NAME}: the ${title} drawing is open`
        : `${SITE_NAME}: DABS posted the ${title} drawing`;

  const heading =
    kind === "closing"
      ? `Last call: the ${escapeHtml(title)} drawing closes ${escapeHtml(closes)}`
      : kind === "open"
        ? `The ${escapeHtml(title)} drawing is open`
        : `DABS posted the ${escapeHtml(title)} drawing`;

  const lead =
    kind === "announced"
      ? `It's listed as coming up on DABS's drawing page. We'll email you again when entries open.`
      : `Entries are open on DABS's drawing page${closes ? ` until ${escapeHtml(closes)} (Mountain Time)` : ""}. ` +
        `Entry is free with a DABS account, one entry per person, Utah residents 21 and over. You can enter for every bottle but win only one.`;

  const items = (detail?.items ?? [])
    .map((it) => {
      const facts = [
        it.price ? `$${escapeHtml(Number(it.price).toFixed(2))}` : null,
        it.bottles != null ? `${n(it.bottles)} bottle${it.bottles === 1 ? "" : "s"}` : null,
        it.previous?.oneIn != null ? `odds in ${it.previous.year}: 1 in ${n(it.previous.oneIn)}` : null,
      ].filter(Boolean);
      return `<li style="margin-bottom:6px"><strong>${escapeHtml(drawingTitle(it.name))}</strong>${facts.length ? `<br/>${facts.join(" · ")}` : ""}</li>`;
    })
    .join("");

  const cta =
    kind === "announced"
      ? ""
      : `<p><a href="${DABS_RHDP_URL}" style="display:inline-block;background:#8a4a14;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Enter on DABS</a></p>`;

  const closeNote = closes
    ? ""
    : kind === "announced"
      ? ""
      : " DABS's page didn't show a closing date; drawings are usually open about five days.";

  const html = `
    <div style="font-family:sans-serif;max-width:560px">
      <h2>${heading}</h2>
      <p>${lead}</p>
      ${items ? `<ul style="padding-left:18px">${items}</ul>` : ""}
      ${cta}
      <p><a href="${SITE_URL}/drawings?${UTM}">See every drawing's odds</a></p>
      <p style="color:#777;font-size:12px">We check DABS's drawing page about four times a day.${closeNote}
      Not affiliated with Utah DABS; enter only on DABS's own site.
      <a href="${SITE_URL}/watchlist?${UTM}">Manage alerts</a></p>
    </div>`;
  return { subject, html };
}
