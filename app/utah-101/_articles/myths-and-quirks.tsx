import { Callout, Cite, GuideLink, MythCard } from "@/components/utah-101";

export default function MythsAndQuirks() {
  return (
    <>
      <p>
        Utah&apos;s drinking laws have changed a lot in the last twenty years, and its reputation hasn&apos;t always
        kept up. Here&apos;s what&apos;s no longer true, followed by the genuinely odd rules that very much are.
      </p>

      <h2 id="myths">Myths (or at least, old news)</h2>
      <div>
        <MythCard myth="You need a membership to get into a bar.">
          <p>
            You used to. Bars were once private clubs that charged a membership fee, but{" "}
            <Cite id="slmagHistory">that requirement ended in 2009</Cite>. Today you just need to be 21 with a valid ID.
            Country clubs and fraternal lodges are still members-only, the same as anywhere.
          </p>
        </MythCard>
        <MythCard myth="Utah beer is all 3.2.">
          <p>
            Grocery-store beer was capped at 3.2% alcohol by weight for decades, but{" "}
            <Cite id="fox13Beer">a 2019 law raised the cap to 5% by volume</Cite>. Stronger beer is sold at state
            liquor stores and poured by the bottle or can at bars and restaurants.
          </p>
        </MythCard>
        <MythCard myth="You can't buy alcohol on Sunday.">
          <p>
            You can. Grocery and convenience stores sell beer{" "}
            <Cite id="dabsStatutes">seven days a week</Cite>, bars and restaurants are open, and breweries, wineries and
            distilleries <Cite id="dabsStatutes">can sell every day</Cite>. Only the state liquor stores close on
            Sundays (and holidays).
          </p>
        </MythCard>
        <MythCard myth="Utah is a dry state.">
          <p>
            Utah tried statewide prohibition, starting in{" "}
            <Cite id="slmagHistory">1917</Cite>. Then in 1933, Utah{" "}
            <Cite id="slmagHistory">became the 36th state to ratify the 21st Amendment</Cite>, the deciding vote that
            ended national Prohibition. The state has sold liquor{" "}
            <Cite id="dabsAbout">since 1935</Cite>.
          </p>
        </MythCard>
        <MythCard myth="Restaurants hide the bartender behind a frosted wall.">
          <p>
            That was the &ldquo;Zion curtain.&rdquo; Since <Cite id="fox13Curtain">a 2017 law</Cite>, restaurants can
            skip it and keep a 10-foot zone around the bar where people under 21 aren&apos;t seated instead.
          </p>
        </MythCard>
        <MythCard myth="You have to order food before you can order a drink.">
          <p>
            At a restaurant you need to be eating, but you can order the drink first; the before-food rule was{" "}
            <Cite id="slmagHistory">dropped in 2013</Cite>. At a bar, food is optional.
          </p>
        </MythCard>
        <MythCard myth="Nobody in Utah drinks.">
          <p>
            In fiscal 2022, Utah&apos;s state liquor stores rang up{" "}
            <Cite id="dabsVisitors">$557 million in sales</Cite>. Plenty of people here drink, and plenty don&apos;t;
            DABS describes its job as serving <Cite id="dabsAbout">all Utahns, whether or not they choose to drink</Cite>.
          </p>
        </MythCard>
      </div>

      <h2 id="quirks">Quirks that are real</h2>
      <h3 id="no-doubles">No doubles</h3>
      <p>
        Cocktails are capped at <Cite id="dabsVisitors">1.5 ounces of the main spirit and 2.5 ounces total</Cite>,
        measured by a metered dispenser. Ask for a double and you&apos;ll get a polite no. Wine by the glass maxes out at
        5 ounces.
      </p>
      <h3 id="no-happy-hour">No happy hour</h3>
      <p>
        <Cite id="cedarHappyHour">Discounts tied to certain hours are illegal</Cite>. All-day specials are fine.
      </p>
      <h3 id="dui-05">The .05 DUI limit</h3>
      <p>
        Utah was the <Cite id="npr05">first state to lower the limit to .08, in 1983</Cite>, and the{" "}
        <Cite id="npr05">first to go to .05, on December 30, 2018</Cite>, just in time for New Year&apos;s Eve. It{" "}
        <Cite id="dabsStatutes">applies to bicycles too</Cite>.
      </p>
      <h3 id="no-draft-strong-beer">Strong beer never comes on draft</h3>
      <p>
        Beer over 5% <Cite id="dabsFaq">can&apos;t be poured on draft</Cite> and isn&apos;t sold in kegs. Any beer on tap
        in Utah is 5% or under, and anything stronger comes in a bottle or can. Private citizens can&apos;t have{" "}
        <Cite id="dabsFaq">any beer in containers over two liters</Cite> either, so no keg parties at home.
      </p>
      <h3 id="no-everclear">No 190-proof anything</h3>
      <p>
        Since 2024, state stores <Cite id="dabsLaws2024">can&apos;t sell products over 80% alcohol</Cite>. DABS noted at
        the time that this affected exactly one product: an Everclear.
      </p>
      <h3 id="no-ice-pops">No boozy ice pops</h3>
      <p>
        Also since 2024: <Cite id="dabsLaws2024">no frozen alcohol products</Cite> in liquor stores or grocery stores.
      </p>
      <h3 id="no-wine-shipping">Wine can&apos;t be shipped to you</h3>
      <p>
        Wine clubs and online shops can&apos;t ship to Utah homes; shipping alcohol directly to consumers{" "}
        <Cite id="wineInstitute">is a felony here</Cite>. If you want a bottle the state doesn&apos;t carry, the legal
        route is a <GuideLink slug="buying-alcohol" hash="cant-find-it">special order</GuideLink>.
      </p>
      <h3 id="pioneer-day">Pioneer Day closes the liquor stores</h3>
      <p>
        State liquor stores close on state holidays, and Utah has one of its own:{" "}
        <Cite id="dabsHolidays">Pioneer Day, July 24</Cite>. If you&apos;re planning a summer barbecue, shop early.
      </p>
      <h3 id="school-lunch">Your bourbon helps pay for school lunch</h3>
      <p>
        By state law, a share of liquor money goes to specific programs. In fiscal 2022 that included{" "}
        <Cite id="dabsVisitors">$54.5 million for the school lunch program</Cite> and about $4.7 million for underage
        drinking prevention.
      </p>
      <h3 id="no-alcohol-sale">Some IDs say &ldquo;NO ALCOHOL SALE&rdquo;</h3>
      <p>
        Since January 2026, people a court has barred from buying alcohol get Utah IDs
        marked <Cite id="dabsId2026">&ldquo;NO ALCOHOL SALE&rdquo; above the photo</Cite>, and anyone selling alcohol
        is expected to look for it.
      </p>
      <h3 id="grocery-approval">Grocery beer needs the state&apos;s OK</h3>
      <p>
        Before a beer can go on a grocery or convenience store shelf, its maker has to get{" "}
        <Cite id="dabsOffPremise">DABS approval for that product</Cite>, label and all.
      </p>

      <h2 id="a-little-history">A little history</h2>
      <p>
        The Latter-day Saint health code known as the Word of Wisdom dates to{" "}
        <Cite id="slmagHistory">1833</Cite>, but early Utah was hardly dry. Pioneers{" "}
        <Cite id="slmagHistory">brewed beer almost as soon as they arrived in 1847</Cite>; tax collectors counted{" "}
        <Cite id="slmagHistory">37 distilleries in Utah in 1869</Cite>; and Brigham Young sent settlers to southern
        Utah on a <Cite id="slmagHistory">&ldquo;Wine Mission&rdquo;</Cite> whose &ldquo;Dixie&rdquo; wine was sold in
        Salt Lake City. Total abstinence became{" "}
        <Cite id="slmagHistory">church policy in 1921</Cite>.
      </p>
      <p>
        After repeal, Utah went through decades of workarounds:{" "}
        <Cite id="slmagHistory">&ldquo;brown bagging&rdquo; your own bottle into restaurants</Cite>, then{" "}
        <Cite id="slmagHistory">1.75-ounce mini bottles from 1969</Cite> until{" "}
        <Cite id="slmagHistory">metered pours replaced them in 1990</Cite>. The 2002 Winter Olympics{" "}
        <Cite id="slmagHistory">loosened enforcement</Cite>, and in 2006 High West in Park City became{" "}
        <Cite id="slmagHistory">Utah&apos;s first legal whiskey distillery since 1870</Cite>. The whole story, year by
        year, is in <GuideLink slug="history">a short history</GuideLink>.
      </p>

      <Callout title="Laws change here a lot">
        <p>
          The legislature revisits alcohol law almost every year (the session runs January to March), and most changes{" "}
          <Cite id="dabsLaws2024">take effect in May</Cite>. If something here sounds different from what you
          remember, that&apos;s probably why. We re-check these pages every May.
        </p>
      </Callout>
    </>
  );
}
