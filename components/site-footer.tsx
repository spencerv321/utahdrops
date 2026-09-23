import { DABS_DISCLAIMER, SITE_NAME } from "@/lib/config";
import { EmailCapture } from "@/components/email-capture";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-secondary/60">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6">
        <div className="space-y-2">
          <h2 className="font-display text-xl font-extrabold tracking-[-0.02em]">
            Know when the list posts and your bottles come back
          </h2>
          <p className="text-sm text-muted-foreground">
            Free email alerts for allocated drops and bottles you watch. No password — we send a sign-in link.
          </p>
          <EmailCapture />
        </div>
        <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
          <p>{DABS_DISCLAIMER}</p>
          <p>
            Official sources:{" "}
            <a className="underline" href="https://abs.utah.gov" rel="noopener">
              Utah DABS
            </a>{" "}
            ·{" "}
            <a
              className="underline"
              href="https://webapps2.abc.utah.gov/ProdApps/ProductLocatorCore"
              rel="noopener"
            >
              DABS Product Locator
            </a>{" "}
            ·{" "}
            <a
              className="underline"
              href="https://abs.utah.gov/shop-products/allocatedandrare/"
              rel="noopener"
            >
              Allocated &amp; Rare
            </a>
          </p>
          <p>
            © {new Date().getFullYear()} {SITE_NAME}. Please drink responsibly.
          </p>
        </div>
      </div>
    </footer>
  );
}
