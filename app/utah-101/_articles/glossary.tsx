import { Cite, GuideLink } from "@/components/utah-101";

export default function Glossary() {
  return (
    <>
      <p>
        Utah alcohol has its own vocabulary. Here it is in plain English, A to Z. Each term has its own link, so you
        can share a single definition.
      </p>
      <dl className="not-prose divide-y border-y">
        {TERMS.map((t) => (
          <div key={t.id} id={t.id} className="scroll-mt-20 py-4 sm:grid sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6">
            <dt className="font-display text-2xl leading-tight">
              <a href={`#${t.id}`} className="hover:text-primary">
                {t.term}
              </a>
            </dt>
            <dd className="mt-1 text-[15px] leading-relaxed text-muted-foreground sm:mt-0.5 [&_a]:text-foreground">
              {t.def}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

const TERMS: { id: string; term: string; def: React.ReactNode }[] = [
  {
    id: "abv",
    term: "ABV",
    def: (
      <>
        Alcohol by volume, the percentage on the label. Utah&apos;s line between &ldquo;beer&rdquo; and
        &ldquo;liquor&rdquo; is <Cite id="dabsLicenseInfo">5% ABV</Cite>.
      </>
    ),
  },
  {
    id: "allocated",
    term: "Allocated",
    def: (
      <>
        A scarce bottle that DABS gets in limited amounts and{" "}
        <Cite id="dabsAllocated">sells first come, first served at select stores on the third Saturday</Cite> of the
        month. See <GuideLink slug="rare-bottles" hash="allocated">rare bottles</GuideLink>.
      </>
    ),
  },
  {
    id: "beer",
    term: "Beer",
    def: (
      <>
        In Utah law, <Cite id="dabsLicenseInfo">traditionally brewed beer at 5% ABV or less</Cite>. The only alcohol
        sold in grocery and convenience stores.
      </>
    ),
  },
  {
    id: "brown-bagging",
    term: "Brown bagging",
    def: (
      <>
        Bringing your own alcohol into a public place to drink there.{" "}
        <Cite id="dabsVisitors">Generally not allowed</Cite>, except wine at a restaurant or bar that agrees, limos and
        charter buses under certain rules, and private parties.
      </>
    ),
  },
  {
    id: "control-state",
    term: "Control state",
    def: (
      <>
        A state that sells alcohol itself, at the wholesale level, the retail level or both, instead of leaving it to
        private businesses. Utah is one of <Cite id="dabsAbout">17</Cite>.
      </>
    ),
  },
  {
    id: "corkage",
    term: "Corkage",
    def: (
      <>
        The fee a restaurant or bar may charge to serve <Cite id="dabsVisitors">a bottle of wine you bring</Cite>.
      </>
    ),
  },
  {
    id: "csc",
    term: "CSC",
    def: (
      <>
        The <Cite id="dabsFaq">code DABS uses to identify each product</Cite>, searchable in its product locator.
        Product pages on Utah Drops use it in the address.
      </>
    ),
  },
  {
    id: "dabs",
    term: "DABS",
    def: (
      <>
        The Utah Department of Alcoholic Beverage Services, which runs the state liquor stores and licenses bars,
        restaurants and events. Until 2022 it was the DABC, the Department of Alcoholic Beverage{" "}
        <em>Control</em>. <Cite id="dabsAbout">It has existed since 1935</Cite>.
      </>
    ),
  },
  {
    id: "drawing",
    term: "Drawing (RHDP)",
    def: (
      <>
        The free online lottery DABS uses for its rarest bottles. Winners{" "}
        <Cite id="dabsRhdpTerms">get the chance to buy one</Cite>. RHDP stands for Rare High Demand Product. See{" "}
        <GuideLink slug="rare-bottles" hash="drawing">the drawing</GuideLink>.
      </>
    ),
  },
  {
    id: "flavored-malt-beverage",
    term: "Flavored malt beverage",
    def: (
      <>
        Flavored, malt-based drinks. Utah law <Cite id="dabsLicenseInfo">counts them as liquor</Cite>, so they&apos;re
        sold in <Cite id="dabsFaq">state stores and package agencies</Cite> rather than grocery stores.
      </>
    ),
  },
  {
    id: "heavy-beer",
    term: "Heavy beer",
    def: (
      <>
        Beer <Cite id="dabsFaq">over 5% ABV</Cite>. Legally liquor: sold in state stores and package agencies, and{" "}
        <Cite id="dabsFaq">never poured on draft</Cite>.
      </>
    ),
  },
  {
    id: "intent-to-dine",
    term: "Intent to dine",
    def: (
      <>
        The rule that restaurants can only serve alcohol to{" "}
        <Cite id="dabsVisitors">people who are eating there</Cite>. Bars don&apos;t have it.
      </>
    ),
  },
  {
    id: "interdicted",
    term: "Interdicted person",
    def: (
      <>
        Someone a court has barred from buying alcohol. Their Utah ID says{" "}
        <Cite id="dabsId2026">&ldquo;NO ALCOHOL SALE&rdquo;</Cite>.
      </>
    ),
  },
  {
    id: "liquor",
    term: "Liquor",
    def: (
      <>
        In Utah law, <Cite id="dabsLicenseInfo">spirits, wine, flavored malt beverages and heavy beer</Cite>: anything
        alcoholic that isn&apos;t &ldquo;beer.&rdquo; Sold packaged only by state stores and package agencies.
      </>
    ),
  },
  {
    id: "metered-dispensing",
    term: "Metered dispensing",
    def: (
      <>
        The calibrated pour every liquor-serving business must use:{" "}
        <Cite id="dabsVisitors">1.5 ounces of the main spirit, 2.5 ounces of spirits total</Cite> per drink.
      </>
    ),
  },
  {
    id: "off-premise",
    term: "Off-premise / on-premise",
    def: (
      <>
        Off-premise means to go (grocery stores, liquor stores). On-premise means drinking where you bought it (bars,
        restaurants). Grocery products need <Cite id="dabsOffPremise">DABS off-premise approval</Cite>.
      </>
    ),
  },
  {
    id: "package-agency",
    term: "Package agency",
    def: (
      <>
        A small liquor outlet <Cite id="dabsFindStore">run by a private operator under contract with the state</Cite>,
        found in small towns, resorts and hotels, and at breweries, wineries and distilleries.
      </>
    ),
  },
  {
    id: "primary-liquor",
    term: "Primary and secondary liquor",
    def: (
      <>
        In a cocktail, the main spirit (up to 1.5 ounces) and any extra spirits added for flavor (up to{" "}
        <Cite id="dabsVisitors">2.5 ounces total</Cite>).
      </>
    ),
  },
  {
    id: "single-event-permit",
    term: "Single event permit",
    def: (
      <>
        What an established organization needs to sell alcohol at an event, from a cash bar to a ticketed party.
        Private parties where guests pay nothing and the public isn&apos;t invited{" "}
        <Cite id="dabsFaq">don&apos;t need one</Cite>.
      </>
    ),
  },
  {
    id: "special-order",
    term: "Special order",
    def: (
      <>
        How to get a product DABS doesn&apos;t stock:{" "}
        <Cite id="dabsSpecialOrders">by the full case, delivered to a store in about 45 days</Cite>. Not available
        for allocated or rare bottles.
      </>
    ),
  },
  {
    id: "state-store",
    term: "State liquor store",
    def: (
      <>
        A liquor and wine store <Cite id="dabsFindStore">owned by the state and staffed by state employees</Cite>. Open
        Monday to Saturday, closed Sundays and state holidays.
      </>
    ),
  },
  {
    id: "third-saturday",
    term: "Third Saturday",
    def: (
      <>
        Allocated drop day: <Cite id="dabsAllocated">the third Saturday of every month</Cite>.
      </>
    ),
  },
  {
    id: "zion-curtain",
    term: "Zion curtain",
    def: (
      <>
        The nickname for the partition that used to hide restaurant bartenders from diners. Since{" "}
        <Cite id="fox13Curtain">2017</Cite>, restaurants can use a 10-foot buffer instead.
      </>
    ),
  },
];
