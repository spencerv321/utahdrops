import { Resend } from "resend";
import { SITE_NAME } from "@/lib/config";

interface Email {
  to: string;
  subject: string;
  html: string;
  /** Resend dedupes sends with the same key (24h), guarding against retries. */
  idempotencyKey?: string;
}

/**
 * A send that will never succeed for this recipient/payload (e.g. invalid
 * address). Callers should stop retrying rather than treat it as an outage.
 */
export class PermanentEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentEmailError";
  }
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Resend when RESEND_API_KEY is set; console log otherwise so local runs
 * are observable without an account. (Auth magic-links are separate — the
 * local Supabase stack catches those in Mailpit.)
 */
export async function sendEmail({ to, subject, html, idempotencyKey }: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL ?? "alerts@example.com";
  if (!key) {
    console.log(`[email:dry-run] to=${to} subject="${subject}"\n${html.slice(0, 500)}`);
    return;
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send(
    {
      from: `${SITE_NAME} <${from}>`,
      to,
      subject,
      html,
    },
    idempotencyKey ? { idempotencyKey } : undefined
  );
  if (error) {
    const status = error.statusCode ?? 0;
    // 4xx other than auth/rate-limit means this particular email is bad.
    if (status >= 400 && status < 500 && ![401, 403, 429].includes(status)) {
      throw new PermanentEmailError(`Resend ${status}: ${error.message}`);
    }
    throw new Error(`Resend: ${error.message}`);
  }
}
