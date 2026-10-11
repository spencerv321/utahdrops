import Link from "next/link";
import { Callout, Cite, FactGrid, GuideLink } from "@/components/utah-101";

export default function MovingToUtah() {
  return (
    <>
      <p>
        Welcome! Moving here changes how you buy alcohol more than almost anything else about Utah. Here&apos;s what
        to do with the bottles you already own, what stops working (wine clubs, mostly), and how locals actually shop.
      </p>

      <h2 id="your-collection">Bringing your collection</h2>
      <p>
        Good news: if you&apos;re moving your home to Utah, you can{" "}
        <Cite id="dabsFaq">bring the liquor you already own, in any quantity</Cite>. A few related rules from DABS:
      </p>
      <ul>
        <li>
          <strong>Inherited bottles</strong> can come in too, in any amount, if you{" "}
          <Cite id="dabsFaq">give DABS documents showing you&apos;re a beneficiary of the estate</Cite>.
        </li>
        <li>
          <strong>After you live here,</strong> coming home from another state you can{" "}
          <Cite id="dabsFaq">bring up to nine liters of liquor bought outside Utah</Cite> (nine from abroad, too, once
          you&apos;ve cleared customs).
        </li>
        <li>
          <strong>Military:</strong> liquor bought on a base is limited to{" "}
          <Cite id="dabsFaq">two liters of wine or liquor, plus one case of heavy beer or flavored malt drinks</Cite>.
        </li>
        <li>
          <strong>Never for resale.</strong> Bringing alcohol in to sell is illegal;{" "}
          <Cite id="dabsFaq">only licensed retailers may sell alcohol</Cite> in Utah.
        </li>
      </ul>

      <h2 id="what-stops-working">What stops working</h2>
      <p>
        <strong>Wine clubs and online orders.</strong> Wineries and retailers can&apos;t ship alcohol to Utah homes;
        doing so is <Cite id="wineInstitute">a felony here</Cite>. Pause those subscriptions before the next shipment.
        If you love a specific bottle, the legal route is a{" "}
        <GuideLink slug="buying-alcohol" hash="cant-find-it">
          special order
        </GuideLink>{" "}
        through a state store, by the case.
      </p>
      <p>
        <strong>Grabbing wine with groceries.</strong> Grocery stores only sell beer up to 5%. Everything else comes
        from state liquor stores, which are{" "}
        <GuideLink slug="buying-alcohol" hash="hours-and-holidays">
          closed Sundays and holidays
        </GuideLink>
        .
      </p>

      <h2 id="how-locals-shop">How locals actually shop</h2>
      <ul>
        <li>
          <strong>Find your stores.</strong> There are{" "}
          <Cite id="dabsFindStore">state liquor and wine stores in the more populated areas</Cite>, smaller package
          agencies elsewhere, and{" "}
          <Cite id="dabsFindStore">some stores have premium wine selections or refrigerated sections</Cite>. Selection
          differs by store, since DABS{" "}
          <Cite id="dabsFaq">stocks each one based on its sales and location</Cite>.
        </li>
        <li>
          <strong>Check before you drive.</strong>{" "}
          <Link prefetch={false} href="/search">
            Search Utah Drops
          </Link>{" "}
          for any bottle to see which stores near you have it, and{" "}
          <Link prefetch={false} href="/watchlist">
            watch it
          </Link>{" "}
          to get an email when it&apos;s back.
        </li>
        <li>
          <strong>Look for barrel picks.</strong> DABS gets occasional{" "}
          <Cite id="dabsBarrelSelects">barrel-select releases in small amounts</Cite> and sends them to a handful of
          stores for a limited time.
        </li>
        <li>
          <strong>Get in on the rare stuff.</strong> The rare-bottle drawing is{" "}
          <Cite id="dabsRhdpTerms">for Utah residents</Cite>, and winners prove it with a Utah driver license or ID (or
          a passport plus a Utah utility bill). Once you live here, you can enter.{" "}
          <GuideLink slug="rare-bottles">How the drop and the drawing work</GuideLink>.
        </li>
        <li>
          <strong>Ask DABS.</strong> The DABS help desk is at <Cite id="dabsFaq">(801) 977-6939</Cite>.
        </li>
      </ul>

      <h2 id="drink-local">Drink local</h2>
      <p>
        Utah&apos;s craft scene has grown fast. In 2018 Salt Lake Magazine counted{" "}
        <Cite id="slmagHistory">15 distilleries, 26 brewers and 4 winemakers</Cite>. DABS&apos;s own &ldquo;Proudly
        Utah&rdquo; list now names more:
      </p>
      <FactGrid
        items={[
          { label: "Breweries", value: "42" },
          { label: "Distilleries", value: "22" },
          { label: "Wineries", value: "12" },
          { label: "Cideries", value: "7" },
        ]}
      />
      <p className="text-sm text-muted-foreground">
        Source: <Cite id="dabsProudlyUtah">DABS, We Are Proudly Utah</Cite>, counted October 2026.
      </p>

      <h2 id="homebrewing">Homebrewing and home winemaking</h2>
      <p>
        Legal since 2009. Utah law lets you make beer or wine at home for personal and family use, up to{" "}
        <Cite id="homebrewStatute">100 gallons a year with one adult in the household, or 200 with two or more</Cite>.
        You can take some out of the house (for example, to a competition, or a few bottles to share with family), in
        limited amounts: for personal use, about{" "}
        <Cite id="homebrewStatute">72 ounces of beer or one liter of wine per adult in the household</Cite> at a time.
        It&apos;s for personal and family use, not for sale.
      </p>

      <Callout title="Your new-resident checklist" tone="amber">
        <ul>
          <li>Bring your collection with the move (any amount is fine).</li>
          <li>Pause wine club shipments.</li>
          <li>Find your nearest state store and its hours (and remember Sundays).</li>
          <li>Make a DABS drawing account once you&apos;re a resident, for the rare bottles.</li>
          <li>
            Learn the restaurant rules in{" "}
            <GuideLink slug="bars-and-restaurants">bars &amp; restaurants</GuideLink>, and the .05 DUI limit in{" "}
            <GuideLink slug="out-and-about">out and about</GuideLink>.
          </li>
        </ul>
      </Callout>
    </>
  );
}
