import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/config";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TabBar } from "@/components/tab-bar";
import { StaleDataBanner } from "@/components/stale-data-banner";
import { AgeGate } from "@/components/age-gate";
import { Toaster } from "@/components/ui/sonner";

// Instrument Sans for UI + data (good tabular figures); Bricolage Grotesque
// gives the wordmark and headlines their chunky, drop-poster character.
const sans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  display: "swap",
});

const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const DESCRIPTION =
  "Fast search, restock alerts, price history, and allocated-drop tracking for Utah's state liquor stores. Not affiliated with Utah DABS.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  // Lets the tab bar pad itself clear of the iPhone home indicator.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4ede2" },
    { media: "(prefers-color-scheme: dark)", color: "#14100e" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} h-full antialiased`}
    >
      {/* Bottom padding keeps content clear of the phone tab bar. */}
      <body className="flex min-h-full flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] font-sans sm:pb-0">
        <SiteHeader />
        <StaleDataBanner />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
        <SiteFooter />
        <TabBar />
        <AgeGate />
        <Toaster />
      </body>
    </html>
  );
}
