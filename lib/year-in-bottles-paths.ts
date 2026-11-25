/** Year in Bottles routes, kept apart from the snapshot so client code doesn't bundle it. */
export const YEAR_IN_BOTTLES_PATH = "/year-in-bottles";
export const editionPath = (edition: string) => `${YEAR_IN_BOTTLES_PATH}/${edition}`;
export const cardPath = (edition: string, slug: string) => `${editionPath(edition)}/${slug}`;
