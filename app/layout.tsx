import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/config";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TabBar } from "@/components/tab-bar";
import { StaleDataBanner } from "@/components/stale-data-banner";
import { AgeGate } from "@/components/age-gate";
import { Toaster } from "@/components/ui/sonner";

// A deliberate pair from one family: Instrument Sans (variable) for everything
// you read or tap, Instrument Serif (one weight + italic, OFL) for the
// wordmark, headlines and the drop date. Two small self-hosted files.
const sans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

const display = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  style: ["normal", "italic"],
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
  themeColor: "#15100d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${sans.variable} ${display.variable} h-full antialiased`}
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
