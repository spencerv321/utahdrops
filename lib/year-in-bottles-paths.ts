/** Year in Bottles routes, kept apart from the snapshot so client code doesn't bundle it. */
export const YEAR_IN_BOTTLES_PATH = "/year-in-bottles";
export const editionPath = (edition: string) => `${YEAR_IN_BOTTLES_PATH}/${edition}`;
export const cardPath = (edition: string, slug: string) => `${editionPath(edition)}/${slug}`;

/** Site-wide banner pointing to the current edition (Utah dates, inclusive). */
export const BANNER_WINDOW = { from: "2026-11-24", to: "2027-01-15" };
export const onBanner = (today: string) => today >= BANNER_WINDOW.from && today <= BANNER_WINDOW.to;
/** Set once someone opens the deck or closes the banner; the banner stays away after that. */
export const BANNER_COOKIE = "ud_yib_seen";
export const markBannerSeen = () => {
  document.cookie = `${BANNER_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 120}; samesite=lax`;
};

/**
 * Year in Bottles actions in discover_events (surface "year"): the banner
 * ("banner" shown once per browser session, clicked; "dismiss"), the homepage
 * link ("home"), the closing panel ("drops", "watch"), and how far people
 * swipe ("card-<slug>" shown once per page view, "card-next" for the panel).
 * Card shares are surface "share", view "year-<slug>"; the whole page "year".
 */
export function parseYearSource(v: string): { surface: "year"; view: string } | null {
  const m = v.match(/^year:(banner|dismiss|home|drops|watch|card-[a-z0-9-]{1,30})$/);
  return m ? { surface: "year", view: m[1] } : null;
}
