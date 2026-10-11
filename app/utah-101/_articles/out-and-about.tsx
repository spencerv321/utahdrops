import { Callout, Cite, GuideLink } from "@/components/utah-101";

export default function OutAndAbout() {
  return (
    <>
      <p>
        Utah is built for getting outside: ski slopes, lakes, red rock, a lot of driving between them. Here&apos;s how
        alcohol fits (and doesn&apos;t) on the road, on the water, in the parks and at your hotel.
      </p>

      <h2 id="driving">Driving: .05, and what counts</h2>
      <p>
        Utah&apos;s DUI limit is a blood alcohol concentration of <strong>.05</strong>, the{" "}
        <Cite id="npr05">lowest in the country since December 30, 2018</Cite>. For many people that&apos;s{" "}
        <Cite id="npr05">about half as many drinks</Cite> as the .08 limit most states use.
      </p>
      <ul>
        <li>
          <strong>Sitting in the driver&apos;s seat counts.</strong> The law covers being in{" "}
          <Cite id="duiUtah">&ldquo;actual physical control&rdquo; of a vehicle</Cite>, not just driving it, so sleeping
          it off behind the wheel is a bad plan.
        </li>
        <li>
          <strong>Under 21: not a drop.</strong> Drivers under 21{" "}
          <Cite id="duiUtah">can&apos;t have any detectable alcohol in their system</Cite>.
        </li>
        <li>
          <strong>Bikes too.</strong> DABS notes the .05 limit{" "}
          <Cite id="dabsStatutes">applies to vehicles and bicycles</Cite>.
        </li>
        <li>
          <strong>Where was your last drink?</strong> Under Utah&apos;s{" "}
          <Cite id="dabsLaws2024">&ldquo;Place of Last Drink&rdquo; program</Cite>, officers record where someone they
          stop last had a drink.
        </li>
      </ul>

      <h2 id="open-containers">Open containers</h2>
      <p>
        No open alcohol in the passenger area of a car, and{" "}
        <Cite id="dabsFaq">no drinking in it</Cite>. An opened bottle (like the rest of that wine from dinner) can ride{" "}
        <Cite id="dabsFaq">in the trunk, out of reach</Cite>. Two exceptions, with conditions:
      </p>
      <ul>
        <li>
          <strong>Limos:</strong> passengers can drink if{" "}
          <Cite id="dabsFaq">
            a partition separates the driver, and the ride starts and ends at your hotel or home
          </Cite>
          .
        </li>
        <li>
          <strong>Chartered buses:</strong> drinking is allowed on the way and back,{" "}
          <Cite id="dabsFaq">only if you&apos;re dropped off at your hotel or home</Cite>. If the bus drops you somewhere
          you&apos;ll likely drive from, no drinking on the return trip.
        </li>
      </ul>

      <h2 id="boating">Boating</h2>
      <p>
        The same .05 limit applies on the water: it&apos;s illegal to{" "}
        <Cite id="townliftBoating">operate a boat at .05 or higher</Cite>. At Lake Powell, Glen Canyon rangers run{" "}
        <Cite id="npsGlenCanyon">extra patrols during Operation Dry Water</Cite> and point out that impairment puts
        operators and passengers alike at risk. Pick a sober captain before you launch.
      </p>

      <h2 id="parks">Parks, trails and public places</h2>
      <p>
        State law bans drinking in a{" "}
        <Cite id="dabsFaq">public building, park or stadium unless it has a license or event permit</Cite>, and{" "}
        <Cite id="dabsFaq">cities and counties can add their own limits</Cite>. In practice it varies a lot by place:
      </p>
      <ul>
        <li>
          Most Utah state and national parks{" "}
          <Cite id="standardParks">allow alcohol, with site-specific restrictions</Cite>.
        </li>
        <li>
          Many city parks <Cite id="standardParks">prohibit it except at permitted events</Cite>.
        </li>
        <li>
          Some popular spots have their own bans: Weber County, for example,{" "}
          <Cite id="standardParks">banned alcohol on the beaches, trails and parking lots at Pineview and Causey reservoirs</Cite>{" "}
          in 2017.
        </li>
      </ul>
      <p>
        Check the rules for the specific park or campground before you pack the cooler. And anywhere in public, being so
        drunk that you <Cite id="dabsFaq">endanger yourself or others or unreasonably disturb people</Cite> is against
        the law.
      </p>

      <h2 id="hotels-and-resorts">Hotels, resorts and the slopes</h2>
      <ul>
        <li>
          <Cite id="dabsFaq">Many hotels and resorts have a package agency</Cite>, a small on-site liquor store for
          guests.
        </li>
        <li>
          Licensed hotels can <Cite id="dabsVisitors">deliver alcohol by room service</Cite>, but{" "}
          <Cite id="dabsVisitors">minibars aren&apos;t allowed</Cite>.
        </li>
        <li>
          Since 2026, hotels can mark a{" "}
          <Cite id="dabsLaws2026">direct route between the bar and the guest rooms</Cite> where you can carry your drink.
        </li>
        <li>
          Ski resorts, golf courses and bowling alleys often hold{" "}
          <Cite id="dabsVisitors">beer licenses</Cite>; full bars and restaurants at resorts follow the{" "}
          <GuideLink slug="bars-and-restaurants">usual bar and restaurant rules</GuideLink>.
        </li>
      </ul>

      <h2 id="airport">At the airport</h2>
      <p>
        Lounges at Salt Lake City International can serve{" "}
        <Cite id="dabsVisitors">from 8 a.m. to midnight, with or without food</Cite>, the earliest start of any license
        type in Utah.
      </p>

      <Callout title="The short version" tone="amber">
        <ul>
          <li>.05 is the limit, for cars, bikes and boats. Under 21 behind the wheel: zero.</li>
          <li>Opened bottles ride in the trunk.</li>
          <li>Parks vary: check before you bring a cooler.</li>
          <li>Hotels: package agency and room service yes, minibar no.</li>
        </ul>
      </Callout>
    </>
  );
}
