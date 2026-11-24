# Pricing and a paid Utah Drops: decision memo

_2026-11-24. Usage numbers come from `report.yml` → `monetization`
([run 87](https://github.com/spencerv321/utahdrops/actions/runs/45404493487)).
This is research, not legal advice. Items marked **[lawyer]** need a Utah attorney._

## The short answer

1. **The first dollar is doable by Dec 31** with an optional "chip in" link. It runs on a
   Stripe Payment Link (no platform cut), with one quiet line on the watchlist page and in
   the footer. It takes about half a day to build once you've made the Stripe link.
2. **A subscription won't pay yet.** 40 people watch anything, and 27 of them watch one
   bottle. Even if 5% paid $3/mo, that's about $6/mo. That's less than the $20/mo Vercel
   Pro plan a paid tier requires.
3. **Q1 2027: test before you build.** Put up a clearly labeled "Drops+ isn't built yet,
   tap if you'd pay" card. Only build it once you pass a gate (below).
4. **Never sell speed or priority on allocated bottles or drawings.** Never take money from
   makers, bars or shops. In Utah, paid placement turns our pages into regulated alcohol
   advertising.

## 1. The audience (real numbers)

| | Number | What it means |
|---|---|---|
| Accounts | 96 real (+3 test). 58 new in the last 30 days | Growing: 14 in Sep, 34 in Oct, 46 so far in Nov |
| Watchers | 40 people, 170 watches, 130 bottles | Median is **1 watch** per person. Only 4 people watch 10+ (max 44) |
| Visitors, 30 days | 2,148 | **93% came on one day only.** 150 came back on 2+ days, 19 on 5+ days |
| Utah visitors/week | ~250–290 lately | Most are on phones (665 Utah mobile vs 162 Utah desktop in 30 days) |
| Sources, 30 days | Direct 1,631 sessions, Google 968, ChatGPT 49, DuckDuckGo 49, Email 30 | Search is the growth engine. Social and shares are near zero (2 shares) |
| Alerts | 10–45 a week. Peak was the Nov 9 week (18 allocated-drop, 13 restock, 8 store) | 5–10 people a week click through from alert emails |
| Check DABS now | 40–50 checks a week | Nobody comes close to the caps: at most 2 taps per IP per hour (cap 12) and 8 a day (cap 300) |
| What people watch | Allocated spirits 69 of 170 watches. Mostly $60+ bourbon and scotch | The core user is an allocated-whiskey hunter |
| Sections, 30 days (visitors) | product 927, search 670, home 320, /drops 119, makers 101, Utah 101 95, discover 39, bars 29, drawings 7 | Guides bring in search traffic but few sign-ins |
| Power users | 1 person active 23 of 30 days (44 watches, 13 alerts). 1 at 10 days. Then a steep drop | Maybe 5–10 regulars in all |

**Is it big enough for subscriptions?** No, not yet. Comparable apps charge
$3–10/mo (below). At 1% of 40 watchers you get 0 payers. At 5% you get 2. What's
realistic now is a few one-time tips from the ~150 returning visitors and ~20 signed-in
regulars. A subscription needs roughly 10× today's watchers before it can cover its own
hosting.

## 2. Constraints

**Utah law**
- Utah Code [32B-1-206](https://le.utah.gov/xcode/Title32B/Chapter1/C32B-1-S206_2023050320230503.html):
  alcohol advertising may not promote intoxication or high alcohol content (5). It also may
  not offer alcohol free to the public (7). Nothing we found in Title 32B bars a third party
  from charging for stock information or alerts. **[lawyer]** to confirm before charging for
  a subscription.
- [R82-1-104](https://www.law.cornell.edu/regulations/utah/Utah-Admin-Code-R82-1-104):
  editorial content counts as "advertising" once an industry member or retailer pays for it,
  directly or indirectly (2)(a)(ii)(B). After that, every page they pay for must meet the
  ad rules in (6): nothing that appeals to minors, no depiction of drinking, no
  "life-enhancing" claims, and so on. Violations can carry penalties up to a class B
  misdemeanor (7). Availability and price information is allowed (6)(o).
  **So money from makers, bars or shops changes the legal status of our pages. [lawyer]**
- DABS data: DABS publishes it, our scraper identifies itself, and we found no terms of use
  on abs.utah.gov. Reselling it as a data feed is a different matter. Ask DABS before
  selling data. **[lawyer]**

**Hosting**
- The Vercel Hobby plan is for
  ["non-commercial personal use only"](https://vercel.com/docs/limits/fair-use-guidelines).
  A paid tier means moving to Pro (~$20/mo; REVIEW.md §5). The only source saying tips are
  fine is an [unofficial forum reply](https://community.vercel.com/t/regarding-fair-use/392.md).
  To be safe, send Vercel support a one-line question before adding the tip link, or accept
  the small risk.
- Resend's free plan allows 100 emails/day. Fine today (the biggest alert week reached 18
  people).

**Payment processors**

| | Alcohol-info site OK? | Fee | Notes |
|---|---|---|---|
| **Stripe** (Payment Link) | US alcohol isn't on the [prohibited list](https://stripe.com/legal/restricted-businesses) (only some countries restrict it). We sell information, not alcohol | [2.9% + 30¢](https://stripe.com/pricing) | Same account handles subscriptions later. No code needed for a link |
| Buy Me a Coffee | Not clear. Its [terms](https://buymeacoffee.com/terms) defer to its guidelines | [5%](https://help.buymeacoffee.com/en/articles/8105744) + processing | Their branding, not ours |
| Ko-fi | Follows [Stripe/PayPal rules](https://help.ko-fi.com/hc/en-us/articles/360007937553) | [5% on most types](https://help.ko-fi.com/hc/en-us/articles/360002506494) | Same as above |
| Lemon Squeezy | **Risky.** It [prohibits](https://docs.lemonsqueezy.com/help/getting-started/prohibited-products) "age restricted products such as… alcohol" | — | Avoid |
| GitHub Sponsors | Built for [open-source maintainers](https://docs.github.com/en/sponsors/getting-started-with-github-sponsors/about-github-sponsors) | — | Wrong fit |
| Patreon | Couldn't verify (page didn't load) | — | Not needed |

**Fairness.** Allocated bottles and drawings are a race for scarce bottles. Any paid
feature that gets someone to the same bottle sooner is "pay to beat other people," and it
would wreck trust. That rules out paid faster allocated-drop alerts, paid earlier store
restock alerts on allocated bottles, and paid priority anything on drawings. **Rule:
paid features can add convenience or depth. They never buy speed or priority on a scarce
event.** Our claim and freshness rules, club-store rules and the DABS pace stay the same for
everyone.

## 3. Options

Revenue rows assume 40 active watchers.

| Option | Likely price | Build | Risk | 1% / 5% pay | First dollar |
|---|---|---|---|---|---|
| **1. Chip in / founding supporter** | Pay what you want, $5 suggested | ½ day | Low (Vercel gray area) | $0 / ~$10 one-time. Realistically a few tips from regulars | **Days** |
| **2. Drops+ subscription** | $3/mo or $25/yr | 1–2 weeks + Vercel Pro | Medium (needs Pro plan; fairness) | $0 / ~$6/mo | Months |
| 3. Maker/bar/shop sponsors | Unknown (would have to ask) | Low | **High**: turns pages into regulated ads; loses neutrality | — | Needs a lawyer first |
| 4. Affiliate | Pennies | Low | DABS is the only seller, so no bottle links. Glassware links feel tacky | ~$0 | — |
| 5. B2B (bar inventory helper / data feed) | Unknown | Weeks | Needs DABS's OK; 612 licensed bars, but zero interviews so far | — | 2027+ |
| 6. Paid guides | $5–10 | Low | Paywalling guides cuts off Google, our main source. /drawings got 7 visitors and holidays 1 in 30 days | ~$0 | — |

**Which Drops+ ideas are actually different from free?**
- More watches: **no.** The median user watches 1 and the max is 44. A cap would only hurt
  the free loop.
- More Check DABS now taps: **no.** Nobody gets near the cap.
- Weekly digest: keep it **free**. It's a growth tool.
- Faster alerts / SMS on allocated bottles: **not allowed** (fairness rule above). Push for
  ordinary restocks is OK, but SMS costs money and needs carrier registration.
- **Price history** (we already store snapshots), **"my shelf" collection tracker** (what
  you own, what you paid, today's DABS price), and **several areas or home stores**: these
  are real differences. They match what the national apps charge for.

**What others charge**
- [Bourboneur](https://apps.apple.com/us/app/bourboneur/id6503428230): $2.99/mo or
  $24.99/yr. One reviewer there would only pay "$0.50 to a $1 per month or $10 per year."
- [BRBNFNDR](https://brbnfndr-site.pages.dev/faq/): 3 free watches, Pro $9.99/mo or
  $99.99/yr (unlimited alerts, price history). Covers thousands of online stores.
- [Bourbon Bro](https://apps.apple.com/us/app/id6752526306) and
  [My World of Whiskey](https://apps.apple.com/us/app/id6755120751): $9.99/mo or $99.99/yr.
- [Get Allocated](https://apps.apple.com/us/app/id6761536463) (NC state stores): free.
- Newsletters: [Substack takes 10%](https://faq.substack.com/p/how-do-paid-subscriptions-on-substack)
  plus processing.

Utah-only, with one state seller, puts us at the low end: **$3/mo or $25/yr**, not $9.99.

## 4. Recommendation

### First dollar (December)
- **What:** a Stripe Payment Link, "customer chooses price," $1 minimum, $5 suggested.
  Stripe's own confirmation page says thank you.
- **Where:** a small outlined card at the bottom of `/watchlist`, plus a footer link
  "Support Utah Drops." Not on product pages, search or the homepage hero. No pop-ups.
- **Wording (card):**
  > **Utah Drops is free and run by one person.** If an alert or a stock check helped you
  > find a bottle, you can chip in toward hosting. Everything stays free either way.
  > [Chip in] · Payments by Stripe
- **Optional:** add the same line to the alert email footer. It changes emails real users
  get, so it needs your yes.
- **Tracking:** count taps as `discover_events` (surface `support`, kind `click`). Count
  payments in Stripe.
- **Steps:** (1) You create the Stripe account and Payment Link and send me the URL. You may
  also want to ask Vercel support about tips on Hobby. (2) I open one small PR. (3) You say
  yes and it merges. About half a day of work. Live in the first week of December if you
  start now.
- **A stranger, not a friend:** don't count anyone you know. Stripe will show the
  supporter's name.

### The real paid product (Q1 2027): test before building
- **Jan–Feb, fake-door test:** a card on `/watchlist` that reads
  "**Drops+ — not built yet.** Price history, your shelf with what you paid, more than one
  home area. About $3/mo. [I'd pay for this] [Not for me]". Taps go to `discover_events`
  (`plus_interest`, view = yes/no). No email list and no promises beyond "we'll tell you
  if it launches."
- **Build gate:** build Drops+ only if, by March 1, **at least 10 different people tap "I'd
  pay"** AND there are at least 150 active watchers (we have 40). Otherwise keep it on
  tips and put the effort into growth (search pages, drop-day sharing).
- **If it passes:** $3/mo or $25/yr through Stripe Checkout, on Vercel Pro. Founding
  supporters get the first year free.
- **Free forever:** search, every stock and price fact, unlimited watches, email alerts at
  the same speed for everyone, allocated-drop and drawing alerts, Check DABS now, every
  guide.

### Tone
The site stays a neutral helper. Rules: one quiet ask in two places, never mid-task, no
paywall on facts, no sponsor placements, no "upgrade" nags in alerts. Paying never changes
what someone sees about stock.

### What to watch, and when to stop
- **Weekly:** support-link taps, payments and total $, active watchers, returning visitors,
  fake-door taps.
- **Change course if:** after 4 weeks, fewer than 1 in 50 watchlist visitors taps the
  support card (reword it or move it), or anyone complains that it feels pushy (tone it
  down).
- **Stop if:** DABS or the regulator raises a concern, a processor flags the account, or
  Vercel says tips need Pro (then upgrade only once tips cover $20/mo).
- **Decision point:** March 1, 2027, with the build gate above.

## Open questions for you
1. OK to create a Stripe account in your name (sole proprietor) for the Payment Link?
2. Ask Vercel support about tips on Hobby, or just upgrade to Pro now?
3. Add the support line to alert email footers? (Needs your yes; it changes emails users get.)
4. Want a 30-minute Utah attorney check before Drops+ or any sponsor talk?
