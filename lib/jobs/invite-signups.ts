import { sql } from "@/lib/db";
import { escapeHtml, PermanentEmailError, sendEmail } from "@/lib/email";
import { SITE_NAME, SITE_URL } from "@/lib/config";
import { withRun } from "./run";

/** Stay under Resend's free daily cap; rerun to continue. */
const MAX_PER_RUN = 90;

/**
 * One-time invitation for people who used the old footer form, which stored
 * their address but never emailed them. Skips anyone who already has an
 * account. Dry run (counts only) unless `send` is true.
 */
export async function runInviteSignupsJob(send = false) {
  return withRun("invite_signups", async () => {
    const pending = await sql<{ email: string; segment: string | null }[]>`
      select s.email, s.segment
      from email_signups s
      where s.invited_at is null
        and not exists (select 1 from auth.users u where lower(u.email) = s.email)
      order by s.created_at`;

    const bySegment: Record<string, number> = {};
    for (const p of pending) bySegment[p.segment ?? "unknown"] = (bySegment[p.segment ?? "unknown"] ?? 0) + 1;

    if (!send) return { dry_run: true, would_invite: pending.length, by_segment: bySegment };

    let sent = 0;
    const errors: string[] = [];
    for (const { email } of pending.slice(0, MAX_PER_RUN)) {
      try {
        await sendEmail({
          to: email,
          subject: `${SITE_NAME}: turn on your alerts`,
          html: inviteHtml(),
          idempotencyKey: `invite/${email}`,
        });
        sent++;
      } catch (err) {
        errors.push(`${email}: ${err instanceof Error ? err.message : String(err)}`);
        // Transient failures are retried next run; bad addresses are marked done.
        if (!(err instanceof PermanentEmailError)) continue;
      }
      await sql`update email_signups set invited_at = now() where email = ${email}`;
    }
    return { sent, remaining: Math.max(0, pending.length - MAX_PER_RUN), failed: errors.length, errors: errors.slice(0, 10) };
  });
}

function inviteHtml(): string {
  const link = `${SITE_URL}/login?next=${encodeURIComponent("/watchlist?welcome=1")}`;
  return `
    <div style="font-family:sans-serif;max-width:560px">
      <h2>Your ${escapeHtml(SITE_NAME)} alerts are ready</h2>
      <p>You signed up on ${escapeHtml(SITE_NAME)} to hear when Utah's allocated list posts and
      when bottles come back in stock. Alerts now take a one-tap sign-in (no password):</p>
      <p><a href="${link}" style="display:inline-block;background:#8a4a14;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Turn on my alerts</a></p>
      <p>Then pick up to 3 home stores and watch any bottle — we'll email you when it's back.</p>
      <p style="color:#777;font-size:12px">You're receiving this once because you entered this address on utahdrops.com.
      Not affiliated with Utah DABS. If you'd rather not, ignore this email — we won't send another.</p>
    </div>`;
}
