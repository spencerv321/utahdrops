import Link from "next/link";
import { Callout, Cite, FactGrid, GuideLink } from "@/components/utah-101";

export default function BuyingAlcohol() {
  return (
    <>
      <Callout title="The short version" tone="amber">
        <ul>
          <li>Beer up to 5% alcohol: grocery and convenience stores, seven days a week.</li>
          <li>Wine, spirits and beer over 5%: state liquor stores and package agencies, run by or for the state.</li>
          <li>State stores open Monday to Saturday. Closed Sundays and state holidays.</li>
          <li>Bring ID. Can&apos;t find a bottle? It can often be special ordered, by the case.</li>
        </ul>
      </Callout>

      <h2 id="who-sells-what">Who sells what</h2>
      <p>
        In most states, the shop down the street decides what to sell. In Utah, the state decides, and for most
        alcohol the state is also the shop. Here&apos;s where each thing lives:
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Where</th>
            <th scope="col">What</th>
            <th scope="col">When</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="font-medium">Grocery &amp; convenience stores</td>
            <td>Beer up to 5% ABV, from DABS&apos;s approved list</td>
            <td>Every day</td>
          </tr>
          <tr>
            <td className="font-medium">State liquor stores</td>
            <td>Spirits, wine, beer over 5%, flavored malt drinks</td>
            <td>Mon&ndash;Sat, closed holidays</td>
          </tr>
          <tr>
            <td className="font-medium">Package agencies</td>
            <td>A smaller selection of the same</td>
            <td>Varies by agency</td>
          </tr>
          <tr>
            <td className="font-medium">Breweries, wineries, distilleries</td>
            <td>Their own products, to drink there or take home</td>
            <td>Every day</td>
          </tr>
        </tbody>
      </table>
      <p className="text-sm text-muted-foreground">
        Sources: <Cite id="dabsStatutes">DABS statutes &amp; rules</Cite>, <Cite id="dabsFaq">DABS FAQ</Cite>,{" "}
        <Cite id="dabsFindStore">DABS store finder</Cite>.
      </p>

      <h2 id="beer-means-something-specific">&ldquo;Beer&rdquo; means something specific here</h2>
      <p>
        Utah law sorts alcohol into two buckets. <strong>Beer</strong> is{" "}
        <Cite id="dabsLicenseInfo">traditionally brewed beer at 5% alcohol by volume or less</Cite>. Everything else
        is <strong>liquor</strong>: spirits, wine, flavored malt beverages, and &ldquo;heavy&rdquo; beer over 5%.
        Only beer can be sold in grocery stores, and only products DABS has{" "}
        <Cite id="dabsOffPremise">approved for grocery and convenience stores</Cite>. That&apos;s why a strong IPA
        or a flavored malt drink you&apos;d grab at a supermarket elsewhere is a state-store item here.
      </p>
      <p>
        The 5% line is fairly new. Grocery beer was capped at 3.2% alcohol by weight for decades until{" "}
        <Cite id="fox13Beer">a 2019 law raised it to 4% by weight (5% by volume)</Cite>, which reached shelves that
        November.
      </p>

      <h2 id="state-liquor-stores">State liquor stores and package agencies</h2>
      <p>
        DABS (the Utah Department of Alcoholic Beverage Services){" "}
        <Cite id="dabsFindStore">runs the state liquor and wine stores with state employees</Cite>, mostly in the more
        populated areas. They carry the full range: spirits, liqueurs, wine and some full-strength beer. A few are
        specialty wine stores with limited-production bottles, and some have refrigerated sections.
      </p>
      <p>
        <strong>Package agencies</strong> fill in the gaps. They&apos;re{" "}
        <Cite id="dabsFindStore">privately run under contract with the state</Cite>, and you&apos;ll find them in
        towns too small for a state store, at resorts and hotels for guests, and at breweries, wineries and
        distilleries selling their own products. There are{" "}
        <Cite id="dabsFaq">more than 130 of them</Cite>, with a more modest selection.
      </p>
      <FactGrid
        items={[
          { label: "State stores", value: "50+", note: <Cite id="dabsStatutes">Statewide, per DABS</Cite> },
          { label: "Package agencies", value: "130+", note: <Cite id="dabsFaq">Towns, resorts, makers</Cite> },
          { label: "Products bought a year", value: "~6,000", note: <Cite id="dabsPurchasing">Wines, spirits and heavy beers</Cite> },
          { label: "State markup", value: "88.5%", note: <Cite id="dabsLaws2024">On liquor, wine and flavored malt drinks</Cite> },
        ]}
      />

      <h2 id="hours-and-holidays">Hours, Sundays and holidays</h2>
      <p>
        State stores are{" "}
        <Cite id="dabsStatutes">open Monday through Saturday, generally from 11 a.m. to 7 p.m. or 10 p.m.</Cite>{" "}
        Hours vary by store, so check yours before a late run. They&apos;re closed on Sundays and on state holidays,
        which in Utah include <Cite id="dabsHolidays">Pioneer Day, July 24</Cite>. On a holiday Monday, Saturday is
        your last chance until Tuesday.
      </p>
      <p>
        Grocery-store beer is <Cite id="dabsStatutes">sold seven days a week</Cite>, and breweries, wineries and
        distilleries <Cite id="dabsStatutes">can sell every day of the week</Cite>, so a Sunday isn&apos;t
        completely dry.
      </p>

      <h2 id="id">ID: what to bring</h2>
      <p>
        You must be <Cite id="dabsFaq">21 to buy, have or be given alcohol</Cite> in Utah. Grocery and convenience
        stores and package agencies{" "}
        <Cite id="dabsId2026">check every customer&apos;s ID, regardless of age</Cite>, so have it out. Accepted:
      </p>
      <ul>
        <li>A valid U.S. driver license or state ID card</li>
        <li>A valid passport</li>
        <li>A U.S. military ID with photo and date of birth</li>
        <li>
          A foreign driver license with photo and date of birth,{" "}
          <Cite id="dabsForeignId">since May 6, 2026</Cite>
        </li>
      </ul>
      <p>
        A Utah <Cite id="dabsFaq">driving privilege card isn&apos;t accepted</Cite> as proof of age. And since 2026,
        Utah IDs for people a court has barred from buying alcohol{" "}
        <Cite id="dabsId2026">carry the words &ldquo;NO ALCOHOL SALE&rdquo;</Cite>; clerks check for it.
      </p>

      <h2 id="cant-find-it">Can&apos;t find a bottle?</h2>
      <p>
        <Cite id="dabsFaq">Not every store carries every product</Cite>; DABS stocks each store based on its sales and
        location. To see who has it right now,{" "}
        <Link prefetch={false} href="/search">
          search Utah Drops
        </Link>{" "}
        (we check DABS stock several times a day) or use DABS&apos;s own product locator. If the state
        doesn&apos;t carry it at all, there&apos;s the <strong>special order</strong> program:
      </p>
      <ul>
        <li>
          <Cite id="dabsSpecialOrders">No extra fee</Cite>, but{" "}
          <Cite id="dabsSpecialOrders">full cases only</Cite> (the producer sets the case size).
        </li>
        <li>
          Orders usually reach your chosen store{" "}
          <Cite id="dabsSpecialOrders">about 45 days after DABS gets a price quote</Cite>, and you have 14 business
          days to pick it up.
        </li>
        <li>
          <Cite id="dabsSpecialOrders">Rare, allocated and high-demand bottles can&apos;t be special ordered</Cite>,
          and old vintages usually can&apos;t either. Those go through{" "}
          <GuideLink slug="rare-bottles">the monthly drop and the drawing</GuideLink>.
        </li>
        <li>Beer at 5% or under can&apos;t be special ordered; that&apos;s grocery-store territory.</li>
      </ul>

      <h2 id="things-you-wont-find">Things you won&apos;t find on the shelf</h2>
      <ul>
        <li>
          <strong>Anything over 80% alcohol.</strong> State stores and package agencies{" "}
          <Cite id="dabsLaws2024">can&apos;t sell it</Cite>, which in practice rules out the 190-proof Everclear.
        </li>
        <li>
          <strong>Boozy ice pops.</strong>{" "}
          <Cite id="dabsLaws2024">Frozen alcohol products are banned</Cite> from state stores and grocery stores alike.
        </li>
        <li>
          <strong>Kegs.</strong> Only licensed businesses and event permit holders{" "}
          <Cite id="dabsFaq">may have beer in containers over two liters</Cite>, and heavy beer is never sold in kegs or
          poured on draft.
        </li>
      </ul>

      <h2 id="why-its-like-this">Why the state runs the stores</h2>
      <p>
        After Prohibition ended in 1933, states got to choose how to sell alcohol. Utah&apos;s legislature decided{" "}
        <Cite id="dabsAbout">the state, not private business, should control sales</Cite>, and created the department
        in 1935. The idea, in DABS&apos;s words, is to make alcohol available to adults who choose to drink{" "}
        <Cite id="dabsAbout">without promoting it</Cite>: with no private profit at stake, nobody has a reason to push
        sales or open more stores.
      </p>
      <p>
        Utah isn&apos;t alone: <Cite id="dabsAbout">17 states and one Maryland county</Cite> control alcohol sales at
        the wholesale or retail level. The money goes back to the public. In fiscal 2022, sales of $557 million
        returned about $230 million to the state and local communities,{" "}
        <Cite id="dabsVisitors">including $54.5 million for school lunches</Cite>. The department dropped
        &ldquo;Control&rdquo; from its name in 2022 and is now{" "}
        <Cite id="dabsAbout">the Department of Alcoholic Beverage Services</Cite>.
      </p>
    </>
  );
}
