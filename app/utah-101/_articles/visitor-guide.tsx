import Link from "next/link";
import { Callout, Cite, GuideLink } from "@/components/utah-101";

export default function VisitorGuide() {
  return (
    <>
      <p>
        Utah has a reputation. Some of it is earned, a lot of it is out of date, and none of it should stop you from
        having a glass of wine after a day on the slopes. Here&apos;s what&apos;s actually different, in the order
        you&apos;re likely to run into it.
      </p>

      <h2 id="1-you-can-drink-here">1. Yes, you can drink here</h2>
      <p>
        Bars, restaurants, breweries, distilleries, hotel lounges and ski resorts all serve alcohol with the right
        license. You don&apos;t need a membership (<Cite id="slmagHistory">that ended in 2009</Cite>) and the beer
        isn&apos;t all 3.2 (<Cite id="fox13Beer">that ended in 2019</Cite>). More on the outdated stuff in <GuideLink slug="myths-and-quirks">myths &amp; quirks</GuideLink>.
      </p>

      <h2 id="2-grocery-beer">2. Grocery and gas stations sell beer, up to 5%</h2>
      <p>
        Beer up to 5% alcohol by volume is in most grocery and convenience stores,{" "}
        <Cite id="dabsStatutes">seven days a week, Sundays included</Cite>. That&apos;s the only alcohol you&apos;ll
        find there: no wine, no spirits, nothing stronger.
      </p>

      <h2 id="3-liquor-stores">3. Everything else comes from a state liquor store</h2>
      <p>
        Wine, spirits and beer over 5% are sold by the state itself, at{" "}
        <Cite id="dabsStatutes">50-plus state liquor stores</Cite> and smaller &ldquo;package agencies&rdquo; in towns,
        resorts and hotels. State stores are{" "}
        <Cite id="dabsStatutes">open Monday through Saturday, generally 11 a.m. to 7 or 10 p.m.</Cite> They&apos;re{" "}
        <strong>closed on Sundays and state holidays</strong>, including{" "}
        <Cite id="dabsHolidays">Pioneer Day on July 24</Cite>, a Utah state holiday that&apos;s easy to miss if
        you&apos;re from out of town.
      </p>
      <Callout title="Pro tip" tone="amber">
        <p>
          Arriving on a holiday weekend? Do your shopping Saturday. And if you&apos;re after a specific bottle,{" "}
          <Link prefetch={false} href="/search" className="underline underline-offset-4">
            search Utah Drops
          </Link>{" "}
          to see which stores near you have it before you drive.
        </p>
      </Callout>

      <h2 id="4-bring-id">4. Bring a real ID, every time</h2>
      <p>
        Grocery and convenience stores and package agencies{" "}
        <Cite id="dabsId2026">check every customer&apos;s ID, whatever your age</Cite>, and bars scan everyone at the
        door. Accepted: a U.S. driver license or state ID, a passport, or a U.S. military ID with photo and birth date.
        Since May 6, 2026, <Cite id="dabsForeignId">foreign driver licenses with a photo and birth date</Cite> work
        too (foreign ID cards that aren&apos;t driver licenses don&apos;t). A{" "}
        <Cite id="dabsFaq">driving privilege card doesn&apos;t count</Cite>.
      </p>

      <h2 id="5-restaurants-vs-bars">5. Restaurants want you to eat. Bars don&apos;t (but they&apos;re 21+)</h2>
      <p>
        At a restaurant, you&apos;re served a drink{" "}
        <Cite id="dabsVisitors">only if you&apos;re dining there</Cite>, so &ldquo;Will you be eating with
        us?&rdquo; is a legal question, not small talk. You can order the drink first. Bars serve without food and
        are <Cite id="utahCodeBar">21 and over</Cite>, with{" "}
        <Cite id="dabsId2026">every ID scanned on the way in</Cite>. The full rundown is in{" "}
        <GuideLink slug="bars-and-restaurants">bars &amp; restaurants</GuideLink>.
      </p>

      <h2 id="6-pours">6. Drinks are measured, and there&apos;s no happy hour</h2>
      <p>
        Bartenders use metered pours:{" "}
        <Cite id="dabsVisitors">1.5 ounces of the main spirit, 2.5 ounces of spirits total</Cite> in any cocktail,
        and wine by the glass tops out at 5 ounces. So there are no doubles, and{" "}
        <Cite id="cedarHappyHour">happy hour discounts are against the law</Cite>.
      </p>

      <h2 id="7-dui">7. The DUI limit is .05, the lowest in the country</h2>
      <p>
        Utah dropped its blood alcohol limit to .05 on{" "}
        <Cite id="npr05">December 30, 2018, the first state to do it</Cite>. For a lot of people that&apos;s about
        half as many drinks as the usual .08. It{" "}
        <Cite id="dabsStatutes">applies on a bicycle too</Cite>. If you&apos;re drinking, don&apos;t drive: use a
        ride, a shuttle or your feet.
      </p>

      <h2 id="8-open-containers">8. Open bottles ride in the trunk</h2>
      <p>
        No open alcohol in the passenger area of a car. An opened bottle is fine{" "}
        <Cite id="dabsFaq">in the trunk, out of reach of the driver and passengers</Cite>. Drinking in{" "}
        <Cite id="dabsFaq">public buildings, parks and stadiums</Cite> isn&apos;t allowed unless the place has a
        license or event permit, and cities can add their own rules.
      </p>

      <h2 id="9-bringing-your-own">9. You can bring some with you</h2>
      <p>
        Driving in with a few bottles from home? You can{" "}
        <Cite id="dabsFaq">bring up to nine liters of liquor bought outside the state</Cite> for your own use. Selling
        it, or anything else, without a license is illegal. Having wine shipped to your hotel won&apos;t work either:{" "}
        <Cite id="wineInstitute">wineries can&apos;t legally ship to consumers in Utah</Cite>.
      </p>

      <h2 id="10-resorts">10. Resorts and hotels make it easy</h2>
      <p>
        <Cite id="dabsFaq">Many hotels and resorts have a package agency</Cite> for buying bottles on site, and
        licensed hotels can <Cite id="dabsVisitors">deliver alcohol through room service</Cite> (no minibars,
        though). Ski resorts, golf courses and bowling alleys often hold{" "}
        <Cite id="dabsVisitors">beer licenses</Cite>.
      </p>

      <Callout title="The short version">
        <ul>
          <li>Beer up to 5%: any grocery store, any day.</li>
          <li>Wine, spirits, strong beer: state liquor stores, Monday to Saturday. Closed Sundays and holidays.</li>
          <li>Carry ID. Expect to eat at restaurants. No doubles, no happy hour.</li>
          <li>.05 is the limit. Open bottles go in the trunk.</li>
        </ul>
      </Callout>
    </>
  );
}
