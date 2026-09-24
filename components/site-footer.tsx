import { DABS_ALLOCATED_URL, DABS_LOCATOR_URL, SITE_NAME } from "@/lib/config";
import { EmailCapture } from "@/components/email-capture";
import { Wordmark } from "@/components/wordmark";
import { getCurrentUser } from "@/lib/supabase/server";

export async function SiteFooter() {
  const user = await getCurrentUser();
  return (
    <footer className="mt-20 border-t">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section id="about" className="scroll-mt-20 space-y-3" aria-labelledby="about-title">
          <Wordmark className="text-[15px]" />
          <h2 id="about-title" className="sr-only">About {SITE_NAME}</h2>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            An independent guide to Utah&apos;s state liquor stores. We&apos;re not DABS and we don&apos;t sell
            anything: we read DABS&apos;s public pages several times a day and show what we find. Counts can lag,
            so call the store before you drive.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <a className="min-h-9 underline decoration-border underline-offset-4 hover:decoration-primary" href="https://abs.utah.gov" rel="noopener">
              Utah DABS
            </a>
            <a className="min-h-9 underline decoration-border underline-offset-4 hover:decoration-primary" href={DABS_LOCATOR_URL} rel="noopener">
              Official product locator
            </a>
            <a className="min-h-9 underline decoration-border underline-offset-4 hover:decoration-primary" href={DABS_ALLOCATED_URL} rel="noopener">
              Allocated &amp; rare
            </a>
          </p>
        </section>
        {user ? null : (
        <section className="space-y-3" aria-labelledby="signup-title">
          <h2 id="signup-title" className="font-display text-2xl leading-tight">
            Get the drop list and your restocks by email
          </h2>
          <p className="text-sm text-muted-foreground">Free. No password: we send a sign-in link.</p>
          <EmailCapture />
        </section>
        )}
        <p className="text-xs text-subtle-foreground lg:col-span-2">
          © {new Date().getFullYear()} {SITE_NAME}. For adults 21 and over. Please drink responsibly.
        </p>
      </div>
    </footer>
  );
}
