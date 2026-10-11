import { Cite, GuideLink } from "@/components/utah-101";

export default function History() {
  return (
    <>
      <p>
        Utah&apos;s alcohol laws make more sense once you know the story: pioneer breweries, a church health code,
        statewide prohibition, the deciding vote to end national Prohibition, and a century of compromises since. Here
        it is, year by year.
      </p>

      <ol className="not-prose my-8 border-l border-border">
        {EVENTS.map((e) => (
          <li key={e.year + e.title} className="relative pb-7 pl-6 last:pb-0">
            <span aria-hidden className="absolute -left-[5px] top-2 size-[9px] rounded-full bg-primary" />
            <p className="font-display text-3xl leading-none text-primary tabular-nums">{e.year}</p>
            <h2 id={`y${e.year.replace(/\D.*$/, "")}-${slug(e.title)}`} className="mt-1 font-sans text-lg font-semibold leading-snug">
              {e.title}
            </h2>
            <div className="mt-1 text-[15px] leading-relaxed text-muted-foreground [&_a]:text-foreground">{e.body}</div>
          </li>
        ))}
      </ol>

      <p>
        For where all of this leaves things today, see the{" "}
        <GuideLink slug="myths-and-quirks">myths &amp; quirks</GuideLink> and{" "}
        <GuideLink slug="buying-alcohol">how buying works</GuideLink>.
      </p>
    </>
  );
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

const EVENTS: { year: string; title: string; body: React.ReactNode }[] = [
  {
    year: "1825",
    title: "The mountain men's rendezvous",
    body: (
      <>
        Fur trappers gather near the Green River for the first rendezvous, a summer-long trading fair with plenty of
        &ldquo;medicine water.&rdquo; An 1834 account has alcohol selling for{" "}
        <Cite id="slmagHistory">four dollars a pint</Cite>.
      </>
    ),
  },
  {
    year: "1833",
    title: "The Word of Wisdom",
    body: (
      <>
        Joseph Smith records the Word of Wisdom, a health code for Latter-day Saints that says{" "}
        <Cite id="dc89">&ldquo;strong drinks are not for the belly&rdquo;</Cite>. It&apos;s{" "}
        <Cite id="slmagHistory">published as section 89 of the Doctrine and Covenants</Cite> in 1835.
      </>
    ),
  },
  {
    year: "1847",
    title: "Pioneers arrive, and start brewing",
    body: (
      <>
        Latter-day Saint pioneers reach the Salt Lake Valley. Partly because of bad water, they{" "}
        <Cite id="slmagHistory">start brewing beer almost as soon as they arrive</Cite>, and distill alcohol for
        medicine.
      </>
    ),
  },
  {
    year: "1856",
    title: "Utah's first documented brewery",
    body: (
      <>
        Orrin Porter Rockwell, bodyguard to Joseph Smith and Brigham Young, is credited with{" "}
        <Cite id="slmagHistory">the first documented brewery in Utah</Cite>, at the Hot Springs Hotel.
      </>
    ),
  },
  {
    year: "1861",
    title: "Mark Twain meets Valley Tan",
    body: (
      <>
        Twain passes through and later writes about Valley Tan, a local whiskey{" "}
        <Cite id="slmagHistory">&ldquo;of Mormon invention and manufactured only in Utah&rdquo;</Cite>.
      </>
    ),
  },
  {
    year: "1864",
    title: "The first commercial brewery",
    body: (
      <>
        German immigrant Henry Wagener opens{" "}
        <Cite id="slmagHistory">Utah&apos;s first commercial brewery</Cite>, on land that&apos;s now Hogle Zoo.
      </>
    ),
  },
  {
    year: "1869",
    title: "Thirty-seven distilleries",
    body: (
      <>
        When federal tax collection begins, collectors count{" "}
        <Cite id="slmagHistory">37 distilleries in Utah</Cite>.
      </>
    ),
  },
  {
    year: "1875",
    title: "The Wine Mission",
    body: (
      <>
        Brigham Young sends John C. Naile to Toquerville to grow grapes and make wine.{" "}
        <Cite id="slmagHistory">&ldquo;Pure Dixie Port Wine&rdquo;</Cite> is sold in Salt Lake City for medicinal use;
        at its peak the winery makes 3,000 gallons a year.
      </>
    ),
  },
  {
    year: "1908",
    title: "Six hundred saloons",
    body: (
      <>
        Utah has <Cite id="slmagHistory">about 600 saloons</Cite> as the Anti-Saloon League pushes for prohibition. The
        1909 legislature narrowly says no.
      </>
    ),
  },
  {
    year: "1917",
    title: "Utah goes dry",
    body: (
      <>
        Gov. Simon Bamberger signs statewide prohibition, making Utah the{" "}
        <Cite id="slmagHistory">23rd state to go dry</Cite>, ahead of national Prohibition.
      </>
    ),
  },
  {
    year: "1921",
    title: "Abstinence becomes church policy",
    body: (
      <>
        Under Heber J. Grant, complete abstinence becomes{" "}
        <Cite id="slmagHistory">church law for Latter-day Saints</Cite>.
      </>
    ),
  },
  {
    year: "1933",
    title: "The deciding vote",
    body: (
      <>
        Utah ratifies the 21st Amendment, becoming the{" "}
        <Cite id="slmagHistory">36th state, and the deciding vote, to end national Prohibition</Cite>.
      </>
    ),
  },
  {
    year: "1935",
    title: "The state opens its liquor stores",
    body: (
      <>
        The legislature creates the liquor control department and{" "}
        <Cite id="dabsAbout">chooses state control over private sales</Cite>. The first state stores open in Salt Lake
        City and Ogden and take in <Cite id="slmagHistory">$54,866 in their first 15 days</Cite>.
      </>
    ),
  },
  {
    year: "1940s–60s",
    title: "Brown bagging",
    body: (
      <>
        No liquor by the drink. Diners{" "}
        <Cite id="slmagHistory">bring their own bottle, often still in the bag</Cite>, and restaurants sell
        &ldquo;set-ups&rdquo; of ice and mixers. Private club members keep bottles in lockers.
      </>
    ),
  },
  {
    year: "1947",
    title: "The newspaper war",
    body: (
      <>
        The Salt Lake Tribune and the Deseret News battle over loosening liquor laws in print. The change{" "}
        <Cite id="slmagHistory">fails by one vote</Cite>.
      </>
    ),
  },
  {
    year: "1969",
    title: "Mini bottles",
    body: (
      <>
        Bars start pouring from <Cite id="slmagHistory">1.75-ounce &ldquo;mini bottles&rdquo;</Cite> instead of
        customers bringing their own.
      </>
    ),
  },
  {
    year: "1990",
    title: "Metered pours",
    body: (
      <>
        The legislature <Cite id="slmagHistory">requires metered dispensers</Cite>, caps cocktails at one ounce of
        liquor, and outlaws mini bottles except in hotels and on airplanes.
      </>
    ),
  },
  {
    year: "2002",
    title: "The Olympics",
    body: (
      <>
        During the Salt Lake Winter Games, the state{" "}
        <Cite id="slmagHistory">relaxes enforcement</Cite> after complaints from an International Olympic Committee
        official.
      </>
    ),
  },
  {
    year: "2006",
    title: "Whiskey is back",
    body: (
      <>
        High West in Park City gets its permit, becoming{" "}
        <Cite id="slmagHistory">Utah&apos;s first legal whiskey distillery since 1870</Cite>.
      </>
    ),
  },
  {
    year: "2008",
    title: "The 1.5-ounce pour",
    body: (
      <>
        The pour rises to <Cite id="slmagHistory">1.5 ounces of a &ldquo;primary&rdquo; liquor</Cite>, with up to 2.5
        ounces total.
      </>
    ),
  },
  {
    year: "2009",
    title: "No more memberships; homebrewing legal",
    body: (
      <>
        Bars <Cite id="slmagHistory">no longer have to charge a membership fee</Cite>, ending the private-club era, and{" "}
        <Cite id="homebrewStatute">homebrewing becomes legal</Cite>.
      </>
    ),
  },
  {
    year: "2011",
    title: "Happy hour ends",
    body: (
      <>
        A liquor law revision <Cite id="cedarHappyHour">prohibits happy hours and other drink discounts</Cite>, and{" "}
        <Cite id="slmagHistory">bans minikegs and ties license numbers to population</Cite>.
      </>
    ),
  },
  {
    year: "2013",
    title: "Drinks before dinner",
    body: (
      <>
        After restaurants are fined for serving drinks before diners ordered food, lawmakers{" "}
        <Cite id="slmagHistory">drop that rule</Cite>. Diners still have to intend to eat.
      </>
    ),
  },
  {
    year: "2017",
    title: "The Zion curtain comes down",
    body: (
      <>
        A sweeping liquor bill lets restaurants{" "}
        <Cite id="fox13Curtain">swap the drink-mixing partition for a 10-foot buffer</Cite>, and raises the state markup
        to 88%.
      </>
    ),
  },
  {
    year: "2018",
    title: ".05",
    body: (
      <>
        On December 30, Utah becomes the{" "}
        <Cite id="npr05">first state to lower its DUI limit to .05</Cite>.
      </>
    ),
  },
  {
    year: "2019",
    title: "Goodbye, 3.2 beer",
    body: (
      <>
        Grocery-store beer goes from 3.2% to{" "}
        <Cite id="fox13Beer">4% by weight (5% by volume)</Cite>, on shelves that November.
      </>
    ),
  },
  {
    year: "2022",
    title: "Control becomes Services",
    body: (
      <>
        The DABC becomes the{" "}
        <Cite id="dabsAbout">Department of Alcoholic Beverage Services</Cite>, dropping &ldquo;Control&rdquo; from its
        name.
      </>
    ),
  },
  {
    year: "2024",
    title: "Canned cocktails, no Everclear",
    body: (
      <>
        Bars can sell <Cite id="dabsLaws2024">canned cocktails</Cite>; state stores{" "}
        <Cite id="dabsLaws2024">stop selling anything over 80% alcohol</Cite> and frozen alcohol pops; the markup goes to
        88.5%.
      </>
    ),
  },
  {
    year: "2025",
    title: "Store number 52",
    body: (
      <>
        On October 1, DABS opens its <Cite id="dabsSlaterville">52nd operating state liquor store</Cite>, in
        Marriott-Slaterville near Ogden.
      </>
    ),
  },
  {
    year: "2026",
    title: "The ID year",
    body: (
      <>
        A new law requires ID checks for every alcohol purchase from January 1, and{" "}
        <Cite id="dabsId2026">the legislature scales it back in March</Cite>. Utah IDs for people barred from buying
        start saying &ldquo;NO ALCOHOL SALE,&rdquo; and in May{" "}
        <Cite id="dabsLaws2026">foreign driver licenses become acceptable ID</Cite>.
      </>
    ),
  },
];
