import { Resend } from "resend";
import { SITE_NAME } from "@/lib/config";

interface Email {
  to: string;
  subject: string;
  html: string;
}

/**
 * Resend when RESEND_API_KEY is set; console log otherwise so local runs
 * are observable without an account. (Auth magic-links are separate — the
 * local Supabase stack catches those in Mailpit.)
 */
export async function sendEmail({ to, subject, html }: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL ?? "alerts@example.com";
  if (!key) {
    console.log(`[email:dry-run] to=${to} subject="${subject}"\n${html.slice(0, 500)}`);
    return;
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: `${SITE_NAME} <${from}>`,
    to,
    subject,
    html,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}
