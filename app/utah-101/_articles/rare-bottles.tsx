import Link from "next/link";
import { Callout, Cite, FactGrid } from "@/components/utah-101";

export default function RareBottles() {
  return (
    <>
      <p>
        Some bottles are made in such small amounts that there&apos;s never enough to go around: Pappy Van Winkle,
        the Buffalo Trace Antique Collection, Blanton&apos;s and friends. In Utah, the state is the store, so the state
        decides who gets them, and it uses two systems meant to keep that fair.
      </p>
      <FactGrid
        items={[
          {
            label: "Allocated",
            value: "First come, first served",
            note: <Cite id="dabsAllocated">At select stores on the third Saturday of each month</Cite>,
          },
          {
            label: "Rare high demand",
            value: "A random drawing",
            note: <Cite id="dabsRhdp">Enter online; winners get the chance to buy</Cite>,
          },
        ]}
      />

      <h2 id="allocated">The monthly allocated drop</h2>
      <p>
        <Cite id="dabsAllocated">Allocated bottles</Cite> are scarce but not the scarcest. Here&apos;s how it works:
      </p>
      <ol>
        <li>
          In the week before the <strong>third Saturday of the month</strong>, DABS posts the list: which bottles, how
          many, and <Cite id="dabsAllocated">which stores</Cite>, usually 5 to 10 of the bigger ones around the state.
        </li>
        <li>
          On Saturday, those stores put the bottles out with signs.{" "}
          <Cite id="dabsAllocated">First come, first served</Cite>.
        </li>
        <li>
          <Cite id="dabsAllocated">One allocated bottle per customer per transaction</Cite>. Want another? Get back in
          line.
        </li>
      </ol>
      <p>
        Store staff <Cite id="dabsAllocated">don&apos;t know what&apos;s coming until it arrives</Cite> and can&apos;t
        share the list before DABS posts it, so asking around won&apos;t help. The posted quantities are what each store
        starts the day with, not a live count.
      </p>
      <Callout title="Get the list the minute it posts" tone="amber">
        <p>
          Utah Drops checks for the list and emails it to everyone with drop alerts on.{" "}
          <Link prefetch={false} href="/drops" className="underline underline-offset-4">
            See this month&apos;s drop
          </Link>
          .
        </p>
      </Callout>

      <h2 id="drawing">The rare high demand drawing</h2>
      <p>
        For the very hardest bottles, DABS runs a lottery, the{" "}
        <Cite id="dabsRhdp">Rare High Demand Product (RHDP) drawing</Cite>. Winning doesn&apos;t get you a free bottle;
        it gets you <Cite id="dabsRhdpTerms">the chance to buy one</Cite> at the state&apos;s price. The rules, from the{" "}
        <Cite id="dabsRhdpTerms">official terms</Cite>:
      </p>
      <ul>
        <li>
          <strong>Who:</strong> Utah residents 21 and over, plus active-duty military stationed in Utah. DABS and state
          employees can&apos;t enter.
        </li>
        <li>
          <strong>How:</strong> make an account on the DABS drawing page and watch for a drawing to open. Entry is
          free.
        </li>
        <li>
          <strong>When:</strong> each drawing is usually open for five days, and there&apos;s no advantage to entering
          early.
        </li>
        <li>
          <strong>How many:</strong> one entry per person per drawing. You can enter for every bottle in a drawing, but
          you can only win one.
        </li>
        <li>
          <strong>If you win:</strong> DABS emails you, ships the bottle to the store you picked, and contacts you when
          it arrives. You have <strong>10 days</strong> to pick it up with a Utah ID (or passport plus a Utah utility
          bill). It can&apos;t be transferred to anyone else.
        </li>
        <li>
          <strong>If you don&apos;t:</strong> you won&apos;t hear anything.
        </li>
      </ul>

      <h2 id="odds">The odds, honestly</h2>
      <p>
        DABS publishes the bottle and entry counts for past drawings. From{" "}
        <Cite id="dabsRhdp">its 2026 Pappy Van Winkle and Buffalo Trace Antique Collection drawing</Cite>:
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Bottle</th>
            <th scope="col" className="text-right">
              Bottles
            </th>
            <th scope="col" className="text-right">
              Entries
            </th>
            <th scope="col" className="text-right">
              Odds
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums [&_td:not(:first-child)]:text-right [&_td:not(:first-child)]:whitespace-nowrap">
          {ODDS.map((r) => (
            <tr key={r.name}>
              <td>
                <span className="block font-medium">{r.name}</span>
                <span className="block text-sm text-muted-foreground">${r.price}</span>
              </td>
              <td>{r.bottles}</td>
              <td>{r.entries.toLocaleString("en-US")}</td>
              <td>1 in {Math.round(r.entries / r.bottles).toLocaleString("en-US")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Roughly 7,000 people entered for each of those bottles. Those prices are also why the drawing is so popular:
        under Utah&apos;s pricing rules, these bottles{" "}
        <Cite id="dabsAllocated">often cost less here than elsewhere</Cite>.
      </p>

      <h2 id="what-you-cant-do">What you can&apos;t do</h2>
      <ul>
        <li>
          <strong>Special order them.</strong> Rare, high-demand and allocated bottles are{" "}
          <Cite id="dabsSpecialOrders">excluded from special orders</Cite>.
        </li>
        <li>
          <strong>Resell them.</strong> In Utah, <Cite id="dabsFaq">only licensed retailers may sell alcohol</Cite> to
          consumers. Flipping a bottle you bought or won, online or in a parking lot, isn&apos;t legal.
        </li>
        <li>
          <strong>Enter twice.</strong> Duplicate entries are{" "}
          <Cite id="dabsRhdpTerms">removed, and can get you disqualified</Cite>.
        </li>
      </ul>

      <h2 id="between-drops">Between drops</h2>
      <p>
        Hard-to-find bottles that aren&apos;t allocated or in a drawing still turn up on regular shelves. That&apos;s
        what Utah Drops is for:{" "}
        <Link prefetch={false} href="/discover">
          Hard to find
        </Link>{" "}
        shows scarce bottles that are in stores now, and a{" "}
        <Link prefetch={false} href="/watchlist">
          watchlist
        </Link>{" "}
        emails you when a bottle you want comes back.
      </p>
    </>
  );
}

/** From DABS's past-drawings page (2026 Pappy Van Winkle & Buffalo Trace Antique Collection), read 2026-10-11. */
const ODDS = [
  { name: "Pappy Van Winkle 15 Year", price: "299.99", bottles: 9, entries: 7198 },
  { name: "Pappy Van Winkle 23 Year", price: "499.99", bottles: 9, entries: 7081 },
  { name: "Eagle Rare 17 Year", price: "154.99", bottles: 6, entries: 7209 },
  { name: "Pappy Van Winkle 10 Year", price: "169.99", bottles: 58, entries: 7338 },
  { name: "George T. Stagg", price: "154.99", bottles: 52, entries: 7102 },
];
