import Link from "next/link";
import { Callout, Cite, GuideLink } from "@/components/utah-101";

export default function BarsAndRestaurants() {
  return (
    <>
      <p>
        Ordering a drink in Utah works much like anywhere else, with a few house rules. Most come down to one
        question: is this place licensed as a <strong>restaurant</strong> or as a <strong>bar</strong>?
      </p>

      <h2 id="restaurant-or-bar">Restaurant or bar? It changes the rules</h2>
      <h3>Restaurants: you&apos;re there to eat</h3>
      <p>
        A licensed restaurant can serve you a drink{" "}
        <Cite id="dabsVisitors">only if you&apos;re dining there</Cite>. That&apos;s the &ldquo;intent to
        dine&rdquo; rule, and it&apos;s why your server asks whether you&apos;ll be eating. You don&apos;t have to
        order food first, though: <Cite id="slmagHistory">a 2013 change</Cite> lets you start with a drink. Kids are
        welcome, and restaurants have to keep{" "}
        <Cite id="dabsLaws2026">food sales at least 70% of the mix</Cite>, which is why they feel like restaurants.
      </p>
      <p>
        Restaurant licenses come in three strengths: <strong>full-service</strong> (cocktails, wine and beer),{" "}
        <strong>limited-service</strong> (wine and beer, <Cite id="dabsVisitors">no spirits</Cite>), and{" "}
        <strong>beer-only</strong>.
      </p>
      <h3>Bars: 21 and over, food optional</h3>
      <p>
        Bars are <Cite id="utahCodeBar">for people 21 and over</Cite> and{" "}
        <Cite id="dabsId2026">scan every ID at the door</Cite>, whatever your age. They{" "}
        <Cite id="dabsVisitors">must have food available</Cite>, but you don&apos;t have to order any. Some bars are
        members-only by nature (country clubs, or fraternal clubs like the Elks and VFW), but an ordinary bar
        doesn&apos;t need a membership; <Cite id="slmagHistory">that requirement ended in 2009</Cite>.
      </p>
      <h3>Taverns and beer joints</h3>
      <p>
        Taverns sell only beer (5% or under) and are{" "}
        <Cite id="dabsVisitors">adults-only too</Cite>. Bowling alleys, golf courses, ski resorts and arenas often
        hold a <Cite id="dabsVisitors">beer-only license</Cite>.
      </p>
      <p>
        Looking for one?{" "}
        <Link prefetch={false} href="/bars" className="underline decoration-primary/60 underline-offset-4 hover:decoration-primary">
          Every licensed bar and tavern in Utah
        </Link>
        , by town, from DABS&apos;s license list.
      </p>

      <h2 id="hours">Hours</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Place</th>
            <th scope="col">Serving hours</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="font-medium">Restaurants</td>
            <td>
              11:30 a.m. to midnight; beer until 1 a.m. From 10:30 a.m. on weekends, holidays and for private parties.
            </td>
          </tr>
          <tr>
            <td className="font-medium">Bars and taverns</td>
            <td>10 a.m. to 1 a.m.</td>
          </tr>
          <tr>
            <td className="font-medium">Banquets and reception centers</td>
            <td>10 a.m. to 1 a.m., for booked events</td>
          </tr>
          <tr>
            <td className="font-medium">Salt Lake airport lounges</td>
            <td>8 a.m. to midnight, with or without food</td>
          </tr>
        </tbody>
      </table>
      <p className="text-sm text-muted-foreground">
        Source: <Cite id="dabsVisitors">DABS residents &amp; visitors information</Cite>. Nobody serves past 1 a.m.
      </p>

      <h2 id="pours">The pour: 1.5 ounces, and no doubles</h2>
      <p>
        Anywhere that serves liquor has to use a{" "}
        <Cite id="dabsVisitors">metered dispenser set to 1.5 ounces of the main spirit</Cite> per drink. Recipes can
        add &ldquo;secondary&rdquo; liquors for flavor, up to <strong>2.5 ounces of spirits total</strong>. So
        there&apos;s no ordering a double, and that Long Island iced tea will be a carefully engineered one. Wine by
        the glass is <Cite id="dabsVisitors">up to 5 ounces</Cite>.
      </p>
      <p>
        Since 2024, bars and full-service restaurants can sell{" "}
        <Cite id="dabsLaws2024">canned cocktails</Cite> (12 ounces or less, 10% alcohol or less), and since May 2026
        they can <Cite id="dabsLaws2026">open them for you</Cite>.
      </p>

      <h2 id="happy-hour">No happy hour</h2>
      <p>
        Utah law <Cite id="cedarHappyHour">prohibits happy hours and other drink discounts</Cite> aimed at certain
        times of day. Bars <Cite id="slmagHistory">adapted with all-day specials</Cite>, which is why you&apos;ll see
        &ldquo;Taco Tuesday&rdquo; pricing and never &ldquo;4 to 6.&rdquo;
      </p>

      <h2 id="id">ID: who gets carded</h2>
      <ul>
        <li>
          <strong>Bars and taverns</strong> <Cite id="dabsId2026">check and scan every ID before you walk in</Cite>.
        </li>
        <li>
          <strong>Restaurants</strong>{" "}
          <Cite id="dabsId2026">check and scan the ID of anyone who looks 35 or younger</Cite> and is ordering
          alcohol.
        </li>
        <li>
          Passports, U.S. driver licenses and state IDs work, and since May 2026,{" "}
          <Cite id="dabsLaws2026">foreign driver licenses</Cite> too.
        </li>
      </ul>
      <p>
        A short-lived rule required checking everyone&apos;s ID everywhere from January 2026, but{" "}
        <Cite id="dabsId2026">the legislature rolled it back in March 2026</Cite> for everyone except bars, taverns
        and stores.
      </p>

      <h2 id="zion-curtain">Where did the &ldquo;Zion curtain&rdquo; go?</h2>
      <p>
        For years, restaurants had to mix drinks behind a partition, nicknamed the Zion curtain, so diners
        couldn&apos;t see them being made. Since <Cite id="fox13Curtain">a 2017 law</Cite>, restaurants can instead
        keep a 10-foot zone around the bar where people under 21 aren&apos;t seated, so in many restaurants
        you&apos;ll now just see a bar.
      </p>

      <h2 id="byo-wine">Bringing your own wine, and taking it home</h2>
      <p>
        You can bring a bottle of <strong>wine</strong> (not beer or spirits) to a licensed restaurant or bar{" "}
        <Cite id="dabsVisitors">if the place agrees</Cite>; staff serve it, and they can charge a corkage fee. Bringing
        any other alcohol into a restaurant isn&apos;t allowed.
      </p>
      <p>
        Didn&apos;t finish a bottle you ordered with dinner?{" "}
        <Cite id="wineSpectator">You can take the rest home</Cite>. Put it{" "}
        <Cite id="dabsFaq">in the trunk</Cite> for the drive: an opened bottle can&apos;t ride in the passenger area.
      </p>

      <h2 id="taprooms">Breweries, wineries and distilleries</h2>
      <p>
        Local makers <Cite id="dabsStatutes">can sell every day of the week</Cite>, including Sundays, to drink there
        or to go. To-go containers <Cite id="dabsStatutes">have to stay closed</Cite> while you&apos;re still at the
        business.
      </p>

      <h2 id="walking-around">Walking around with a drink</h2>
      <p>
        Generally, your drink stays where you bought it. A few exceptions are new: hotels can mark a{" "}
        <Cite id="dabsLaws2026">route from the bar to guest rooms</Cite> where you can carry a drink, and a bar can
        walk you and your drink to <Cite id="dabsLaws2026">its own restaurant next door</Cite> (under 35 feet, staff
        escort, no public sidewalk). Parks and public buildings are{" "}
        <Cite id="dabsFaq">off-limits without a permit</Cite>.
      </p>

      <Callout title="Heading home?" tone="brand">
        <p>
          Utah&apos;s DUI limit is <Cite id="npr05">.05, the lowest in the country</Cite>, about half as many drinks as
          the usual .08 for a lot of people. Get a ride. More in the{" "}
          <GuideLink slug="visitor-guide" hash="7-dui">
            visitor cheat sheet
          </GuideLink>
          .
        </p>
      </Callout>
    </>
  );
}
