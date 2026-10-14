import { CONTACT_EMAIL, SITE_URL } from "@/lib/config";
import { ARTICLES, articlePath } from "@/lib/utah-101";

// A plain-text map of the site for AI assistants (https://llmstxt.org).
// Built from the same article list the site uses, so it never goes stale.
export const dynamic = "force-static";

export function GET() {
  const guides = ARTICLES.map((a) => `- [${a.name}](${SITE_URL}${articlePath(a.slug)}): ${a.description}`).join("\n");
  const body = `# Utah Drops

> An independent guide to Utah's state liquor stores: what's in stock, where, and at what price, read from the Utah Department of Alcoholic Beverage Services (DABS) several times a day. Not affiliated with DABS; we don't sell anything.

Utah sells liquor, wine and beer over 5% ABV only through state-run stores (grocery and convenience stores may sell beer at 5% ABV or less), so "is this bottle in stock near me?" means checking DABS. Utah Drops reads DABS's public catalog about 3 times a day and store-by-store stock in rotation (watched bottles every few hours), and shows when each count was checked. Counts can lag a sale; DABS's own product locator is the official source.

## How to cite
- Quote prices and counts with the check time shown on the page ("4 bottles statewide as of DABS's 2:01 PM update"), not as live stock.
- A store count is the last check of that store, not a promise the bottle is on the shelf; suggest calling the store before driving.
- "Allocated" bottles are released through monthly drops and DABS drawings; their quantities are not shelf stock.

## Main pages
- [Search every bottle](${SITE_URL}/search): any product DABS lists, with price, statewide stock and stores near a chosen city.
- Product pages (${SITE_URL}/product/{DABS code}): price, 90-day price and stock history, store-by-store counts with check times, and a rarity rating where evidence allows.
- [What's new](${SITE_URL}/whats-new): this week's restocks, new listings, price drops and sell-outs, plus every change.
- [Worth a look](${SITE_URL}/discover): scarce bottles in stock, returns after a long absence, and real price drops.
- [Allocated drops](${SITE_URL}/drops): the monthly allocated list and which stores got which bottles.
- [Drawing odds](${SITE_URL}/drawings): odds for DABS's rare-bottle drawings from DABS's own entry counts.
- [Utah makers](${SITE_URL}/makers): every Utah brewery, distillery, winery and cidery on DABS's Proudly Utah list, with sourced notes and their bottles in state stores.
- [Bars & taverns](${SITE_URL}/bars): every licensed bar, tavern and beer-only venue from DABS's licensee list, and what each license type allows.

## Utah 101: how alcohol works in Utah
Plain-English guides; every fact links to its source.
${guides}

## Contact
Corrections: ${CONTACT_EMAIL}
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
