import { Callout, Cite, FactGrid, GuideLink } from "@/components/utah-101";

export default function NewToDrinking() {
  return (
    <>
      <p>
        Maybe you grew up in a home where nobody drank. Maybe you&apos;ve stepped away from a faith that asks people
        not to, or you just never got around to it. Whatever brought you here, this is the friendly version: what&apos;s
        actually in a drink, how to order one, how to stay safe, and how Utah&apos;s rules fit in. No judgment either
        way, and you never have to drink at all.
      </p>

      <h2 id="whats-in-a-drink">What&apos;s actually in a drink</h2>
      <p>
        Drinks look very different, but in the U.S. they&apos;re measured the same way: in{" "}
        <strong>standard drinks</strong> of about <Cite id="niaaaStandardDrink">14 grams (0.6 ounces) of pure alcohol</Cite>
        . Each of these is about one:
      </p>
      <FactGrid
        items={[
          { label: "Beer", value: "12 oz at 5%", note: "A regular can or bottle" },
          { label: "Wine", value: "5 oz at 12%", note: "A standard glass" },
          { label: "Spirits", value: "1.5 oz at 40%", note: "One shot of vodka, whiskey, gin, rum or tequila" },
          { label: "Strong beer", value: "12 oz at 10% = 2", note: "Same size, twice the alcohol" },
        ]}
      />
      <p className="text-sm text-muted-foreground">
        Source: <Cite id="niaaaStandardDrink">NIAAA, What is a standard drink?</Cite>
      </p>
      <p>
        That last row is the one that surprises people: a big craft beer or a strong cocktail can be two drinks or more.
        In Utah, a cocktail can hold up to{" "}
        <GuideLink slug="bars-and-restaurants" hash="pours">
          2.5 ounces of spirits
        </GuideLink>
        , which can work out to well over one standard drink.
      </p>

      <h2 id="reading-the-label">Reading the label: ABV and proof</h2>
      <p>
        <strong>ABV</strong> (alcohol by volume) is the percentage of the drink that&apos;s alcohol. Spirits also list{" "}
        <strong>proof</strong>, which in the U.S. is simply{" "}
        <Cite id="cfrProof">twice the ABV</Cite>: an 80-proof whiskey is 40% alcohol. As a rough guide from the chart
        above, beer usually runs around 5%, wine around 12% and spirits around 40%.
      </p>

      <h2 id="how-to-order">How to order without feeling lost</h2>
      <ul>
        <li>
          <strong>Beer:</strong> ask what they have on tap. Anything on draft in Utah is{" "}
          <GuideLink slug="myths-and-quirks" hash="no-draft-strong-beer">
            5% or under
          </GuideLink>
          ; stronger beers come in bottles and cans.
        </li>
        <li>
          <strong>Wine:</strong> by the glass or the bottle. It&apos;s completely normal to tell a server what you like
          (or don&apos;t) and ask for a suggestion.
        </li>
        <li>
          <strong>Spirits:</strong> <Cite id="wikiStraightUp">&ldquo;neat&rdquo;</Cite> means poured on its own, no ice;
          &ldquo;on the rocks&rdquo; means over ice; &ldquo;up&rdquo; means chilled with ice, then strained into a glass
          without it.
        </li>
        <li>
          <strong>Cocktails:</strong> the easiest start. Pick something with ingredients you already like, or ask the
          bartender for something light.
        </li>
        <li>
          <strong>At a restaurant,</strong> they&apos;ll ask if you&apos;re eating;{" "}
          <GuideLink slug="bars-and-restaurants" hash="restaurant-or-bar">
            that&apos;s the law here
          </GuideLink>
          , not a sales pitch. And bring ID, whatever your age.
        </li>
      </ul>

      <h2 id="go-slow">Go slow, and eat</h2>
      <p>
        How strongly alcohol hits you depends on more than the number of drinks. NIAAA lists{" "}
        <Cite id="niaaaOverdose">
          age, tolerance, sex, how fast you drink, medications and how much you&apos;ve eaten
        </Cite>{" "}
        among the factors. Two things worth knowing early:
      </p>
      <ul>
        <li>
          <strong>It keeps rising after you stop.</strong> Blood alcohol{" "}
          <Cite id="niaaaOverdose">can keep climbing even after the last sip</Cite>, as alcohol already in your stomach
          is absorbed. Wait before deciding you &ldquo;feel fine.&rdquo;
        </li>
        <li>
          <strong>Medications matter.</strong> Mixing alcohol with some medicines, including{" "}
          <Cite id="niaaaMeds">many over-the-counter cold, allergy and pain remedies</Cite>, can be dangerous. Ask a
          pharmacist if you&apos;re not sure.
        </li>
      </ul>
      <p>
        Binge drinking, as NIAAA defines it, is roughly{" "}
        <Cite id="niaaaOverdose">five or more drinks for men, or four or more for women, in about two hours</Cite>. The
        federal Dietary Guidelines dropped their old daily drink numbers in January 2026; the advice now is simply to{" "}
        <Cite id="vinepairDga">&ldquo;consume less alcohol for better overall health.&rdquo;</Cite>
      </p>

      <Callout title="Know the danger signs" tone="brand">
        <p>
          Signs of alcohol overdose include{" "}
          <Cite id="niaaaOverdose">
            confusion, trouble staying conscious, vomiting, seizures, slow or troubled breathing, clammy skin and very low
            body temperature
          </Cite>
          . If you see them, <strong>call 911</strong>. Don&apos;t let the person &ldquo;sleep it off,&rdquo; and
          don&apos;t count on coffee, cold showers or walking it off: <Cite id="niaaaOverdose">they don&apos;t work</Cite>.
        </p>
      </Callout>

      <h2 id="saying-no">Saying no, anytime</h2>
      <p>
        You can stop at one, switch to water, or skip it entirely, and you don&apos;t owe anyone an explanation. Asking
        what they have without alcohol is always a normal question. And if you&apos;re driving, the answer in Utah is easy:
        the limit is <Cite id="npr05">.05, the lowest in the country</Cite>, so plan a ride before the first drink.
      </p>

      <h2 id="buying-your-first-bottle">Buying your first bottle</h2>
      <p>
        Beer up to 5% is in grocery stores; wine and spirits come from state liquor stores, which are closed on Sundays.
        The full picture is in <GuideLink slug="buying-alcohol">how buying works</GuideLink>, and every word you might
        hear at the counter is in the <GuideLink slug="glossary">glossary</GuideLink>.
      </p>

      <Callout title="If drinking stops feeling good">
        <p>
          SAMHSA&apos;s National Helpline, <strong>1-800-662-HELP (4357)</strong>, is{" "}
          <Cite id="samhsaHelpline">free, confidential and open 24/7</Cite>, in English and Spanish, for you or someone
          you&apos;re worried about.
        </p>
      </Callout>
    </>
  );
}
