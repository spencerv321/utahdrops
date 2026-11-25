import { cookies } from "next/headers";
import { YearBannerBar } from "@/components/year-banner-bar";
import { utahToday } from "@/lib/holiday";
import { BANNER_COOKIE, onBanner } from "@/lib/year-in-bottles-paths";

/** One quiet line at the top of every page while the year-end window lasts. */
export async function YearBanner() {
  if (!onBanner(utahToday())) return null;
  if ((await cookies()).get(BANNER_COOKIE)?.value === "1") return null;
  return <YearBannerBar />;
}
