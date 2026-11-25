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
