import { Callout, Cite, GuideLink } from "@/components/utah-101";

export default function HostingAndEvents() {
  return (
    <>
      <p>
        Throwing a party, planning a wedding, or running a fundraiser? Utah&apos;s rules mostly turn on one question:{" "}
        <strong>is anyone paying for the drinks?</strong> If not, and it&apos;s a private guest list, you&apos;re
        probably in the clear. This page covers the general shape of the rules. For anything you&apos;re selling, DABS
        and your city or county have the final say, so check with them early.
      </p>

      <h2 id="private-parties">Private parties: no permit needed</h2>
      <p>
        You don&apos;t need a permit from DABS or your city to serve alcohol at an event if{" "}
        <Cite id="dabsFaq">
          you don&apos;t charge guests for drinks, don&apos;t charge admission, and the event isn&apos;t open to the
          public
        </Cite>
        . That covers most home parties, holiday gatherings and weddings with an open bar the hosts pay for.
      </p>
      <p>
        Careful with how you invite people, though. DABS says that if you&apos;re{" "}
        <Cite id="dabsVisitors">
          advertising on social media, handing out tickets, or charging an admission fee, it is not a private party
        </Cite>
        . And if you hold it somewhere without a liquor license, the space{" "}
        <Cite id="dabsFaq">must not be open or accessible to the general public</Cite>.
      </p>

      <h2 id="stocking-up">Stocking up</h2>
      <ul>
        <li>
          <strong>Shop early.</strong> Wine, spirits and beer over 5% come from state liquor stores, which{" "}
          <GuideLink slug="buying-alcohol" hash="hours-and-holidays">
            close Sundays and holidays
          </GuideLink>
          . A Saturday-night party on a holiday weekend means buying by Saturday.
        </li>
        <li>
          <strong>Need something unusual, or a lot of it?</strong> State stores carry a wide selection, and DABS can{" "}
          <Cite id="dabsFaq">special order a product for your event</Cite> if you plan ahead. Special orders are{" "}
          <Cite id="dabsSpecialOrders">by the full case and take about 45 days</Cite>.
        </li>
        <li>
          <strong>No kegs.</strong> Only licensed businesses and event permit holders may have{" "}
          <Cite id="dabsFaq">beer in containers bigger than two liters</Cite>. Plan on cans and bottles.
        </li>
        <li>
          <strong>No freebies from brands.</strong> Alcohol companies{" "}
          <Cite id="dabsFaq">can&apos;t donate their products</Cite> to your event or party, even as a sponsor.
        </li>
      </ul>

      <h2 id="weddings">Weddings and receptions</h2>
      <p>You have a few options:</p>
      <ul>
        <li>
          <strong>A licensed reception center.</strong> These{" "}
          <Cite id="dabsVisitors">can sell and serve alcohol at booked events like weddings</Cite>, any day from 10 a.m.
          to 1 a.m.
        </li>
        <li>
          <strong>A licensed restaurant or bar.</strong> You can have them{" "}
          <Cite id="dabsFaq">serve your guests under their license</Cite>, or rent the space and{" "}
          <Cite id="dabsFaq">bring your own alcohol to serve free</Cite>, if they allow it. Expect a fee either way.
        </li>
        <li>
          <strong>Your own venue or backyard.</strong> Fine as a private party: free drinks, invited guests, not open to
          the public.
        </li>
      </ul>
      <p>
        <strong>About caterers:</strong> in Utah, caterers{" "}
        <Cite id="dabsFaq">aren&apos;t licensed to sell alcohol</Cite> and can&apos;t hold a permit for you. They can
        bartend and be paid for their service, but if you want a cash bar, the permit has to be yours.
      </p>

      <h2 id="selling-drinks">Selling drinks: permits</h2>
      <p>
        A cash bar, a ticket that includes drinks, or an event open to the public all need a permit. There are two
        kinds:
      </p>
      <h3>Single event permit (spirits, wine and beer)</h3>
      <ul>
        <li>
          Only for{" "}
          <Cite id="dabsFaq">
            established organizations: corporations, partnerships, LLCs, incorporated associations, churches and political
            organizations
          </Cite>
          , that have existed for at least a year. Not for individuals.
        </li>
        <li>
          Get <Cite id="dabsFaq">local consent and permits from your city or county first</Cite>, then apply to DABS.
        </li>
        <li>
          Apply <Cite id="dabsFaq">at least 30 days ahead</Cite>. Applications that arrive less than seven business days
          before the event won&apos;t be considered.
        </li>
      </ul>
      <h3>Temporary beer permit (beer only)</h3>
      <p>
        Selling only beer? A <Cite id="dabsFaq">temporary beer permit</Cite> covers events of up to 30 days and is{" "}
        <Cite id="dabsFaq">available to anyone</Cite>. Same process: local consent first, then DABS.
      </p>

      <h2 id="parks">Parks and public places</h2>
      <p>
        Planning a picnic? Drinking in a{" "}
        <Cite id="dabsFaq">public building, park or stadium isn&apos;t allowed without a license or event permit</Cite>,
        and cities and counties can add their own rules. More in{" "}
        <GuideLink slug="out-and-about" hash="parks">
          out and about
        </GuideLink>
        .
      </p>

      <Callout title="Good host basics" tone="brand">
        <ul>
          <li>
            No one under 21: in Utah you must be{" "}
            <Cite id="dabsFaq">21 to buy, have, or be given alcohol</Cite>.
          </li>
          <li>
            Utah&apos;s DUI limit is <Cite id="npr05">.05</Cite>. Line up rides, or offer the couch.
          </li>
          <li>Put out plenty of food and non-alcoholic drinks.</li>
        </ul>
      </Callout>
    </>
  );
}
