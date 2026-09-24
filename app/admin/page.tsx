import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { adminEmails, isAdmin } from "@/lib/admin";
import { JOB_MAX_AGE_HOURS } from "@/lib/config";
import { getAccounts, getDashboard, getRatingsBeta, parseRange, RANGES, TZ, type Kpis, type Row } from "@/lib/admin-metrics";
import { TrendChart } from "@/components/admin/trend-chart";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// ── formatting ───────────────────────────────────────────────────────

const num = (v: number) => v.toLocaleString("en-US");

function duration(secs: number): string {
  if (secs < 1) return "0s";
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m ? `${m}m ${s}s` : `${s}s`;
}

function ago(d: Date | null): string {
  if (!d) return "never";
  const mins = Math.round((Date.now() - new Date(d).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function shortDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ });
}

type Delta = { text: string; good: boolean | null };

function delta(cur: number, prev: number, lowerIsBetter = false): Delta {
  if (!prev && !cur) return { text: "—", good: null };
  if (!prev) return { text: "new", good: !lowerIsBetter };
  const pct = ((cur - prev) / prev) * 100;
  if (Math.abs(pct) < 1) return { text: "±0%", good: null };
  const up = pct > 0;
  return { text: `${up ? "↑" : "↓"} ${Math.abs(Math.round(pct))}%`, good: up !== lowerIsBetter };
}

// ── building blocks ──────────────────────────────────────────────────

function Panel({ title, note, className, children }: { title: string; note?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-lg border bg-card p-5", className)}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{title}</h3>
        {note && <span className="text-xs text-subtle-foreground">{note}</span>}
      </div>
      {children}
    </section>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 space-y-4">
      <h2 className="font-display text-3xl leading-none">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, d, hint }: { label: string; value: string; d?: Delta; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
        <span className="text-3xl font-medium tabular-nums tracking-tight">{value}</span>
        {d && (
          <span
            className={cn(
              "text-xs tabular-nums",
              d.good === true && "text-success",
              d.good === false && "text-destructive",
              d.good === null && "text-subtle-foreground"
            )}
          >
            {d.text}
          </span>
        )}
      </div>
      {hint && <div className="mt-1 text-xs text-subtle-foreground">{hint}</div>}
    </div>
  );
}

/** Ranked list with a proportional bar behind each row. */
function BarList({ rows, empty = "Nothing yet.", unit }: { rows: Row[]; empty?: string; unit?: string }) {
  if (!rows.length) return <p className="py-2 text-sm text-subtle-foreground">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <ol className="space-y-1">
      {rows.map((r) => (
        <li key={r.label + (r.sub ?? "")} className="relative flex items-center gap-3 rounded px-2 py-1.5 text-sm">
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 rounded bg-primary/15"
            style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
          />
          <span className="relative min-w-0 flex-1 truncate" title={r.label}>
            {r.href ? (
              <Link prefetch={false} href={r.href} className="hover:underline">
                {r.label}
              </Link>
            ) : (
              r.label
            )}
            {r.sub && <span className="ml-2 text-xs text-subtle-foreground">{r.sub}</span>}
          </span>
          <span className="relative tabular-nums text-muted-foreground">
            {num(r.value)}
            {unit ? ` ${unit}` : ""}
            <span className="ml-2 inline-block w-9 text-right text-xs text-subtle-foreground">
              {Math.round((r.value / total) * 100)}%
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function HourStrip({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  const peak = counts.indexOf(Math.max(...counts));
  const label = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  return (
    <div>
      <div className="flex h-24 items-end gap-[3px]">
        {counts.map((c, h) => (
          <div
            key={h}
            title={`${label(h)}: ${num(c)} views`}
            className={cn("flex-1 rounded-t-[3px]", h === peak && c ? "bg-primary" : "bg-primary/40")}
            style={{ height: `${Math.max(2, (c / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-subtle-foreground">
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>11pm</span>
      </div>
      {counts.some(Boolean) && (
        <p className="mt-3 text-sm text-muted-foreground">
          Busiest around <span className="text-foreground">{label(peak)}</span> Mountain time.
        </p>
      )}
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────

const SECTIONS = [
  ["traffic", "Traffic"],
  ["content", "Content"],
  ["audience", "Audience"],
  ["users", "Users"],
  ["ratings", "Ratings"],
  ["data", "Data"],
] as const;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!isAdmin(user)) {
    // Say why, so a setup mistake is obvious (the route itself isn't secret).
    const configured = adminEmails().length > 0;
    return (
      <div className="mx-auto max-w-md space-y-3 pt-12">
        <h1 className="text-4xl leading-none">Not an admin</h1>
        <p className="text-muted-foreground">
          You&apos;re signed in as <span className="text-foreground">{user.email}</span>.
        </p>
        <p className="text-muted-foreground">
          {configured
            ? "That email isn't on the admin list. Check ADMIN_EMAILS in Vercel matches it exactly, then redeploy."
            : "No admin list is set on this deployment. Add ADMIN_EMAILS in Vercel, then redeploy."}
        </p>
      </div>
    );
  }

  const range = parseRange((await searchParams).range);
  const [d, a, rb] = await Promise.all([getDashboard(range), getAccounts(range), getRatingsBeta(range)]);
  const c: Kpis = d.current;
  const p: Kpis = d.previous;
  const bounce = (k: Kpis) => (k.sessions ? (k.bounced / k.sessions) * 100 : 0);
  const perSession = (k: Kpis) => (k.sessions ? k.pageviews / k.sessions : 0);
  const vs = range === "today" ? "vs. yesterday so far" : `vs. previous ${RANGES[range].days} days`;

  return (
    <div className="space-y-10 pb-10">
      {/* Header */}
      <div className="sticky top-14 z-30 -mx-4 space-y-3 border-b bg-background/95 px-4 pb-3 pt-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-4xl leading-none">Dashboard</h1>
            <AutoRefresh renderedAt={d.now.toISOString()} />
          </div>
          <nav aria-label="Date range" className="flex gap-1 rounded-md bg-raised p-1">
            {Object.entries(RANGES).map(([key, r]) => (
              <Link
                key={key}
                prefetch={false}
                href={`/admin?range=${key}`}
                aria-current={range === key ? "page" : undefined}
                className={cn(
                  "rounded px-3 py-1.5 text-sm transition-colors",
                  range === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </Link>
            ))}
          </nav>
        </div>
        <nav aria-label="Sections" className="flex gap-5 overflow-x-auto whitespace-nowrap text-sm text-muted-foreground">
          <a href="#overview" className="hover:text-foreground">Overview</a>
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
      </div>

      {/* Overview */}
      <section id="overview" className="scroll-mt-32 grid gap-4 lg:grid-cols-[18rem_1fr]">
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex size-2.5">
              {d.live.count > 0 && <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" />}
              <span className={cn("relative size-2.5 rounded-full", d.live.count ? "bg-success" : "bg-subtle-foreground")} />
            </span>
            On the site now
          </div>
          <div className="mt-2 text-6xl font-medium tabular-nums tracking-tight">{d.live.count}</div>
          <div className="text-xs text-subtle-foreground">active in the last 5 minutes</div>
          <ul className="mt-4 space-y-2 text-sm">
            {d.live.visitors.slice(0, 8).map((v, i) => (
              <li key={i} className="border-t pt-2">
                <div className="truncate" title={v.path}>{v.path}</div>
                <div className="text-xs text-subtle-foreground">
                  {[v.city, v.device, v.source && `via ${v.source}`].filter(Boolean).join(" · ")} · {v.seconds < 60 ? `${v.seconds}s` : `${Math.round(v.seconds / 60)}m`} ago
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Visitors" value={num(c.visitors)} d={delta(c.visitors, p.visitors)} hint={`${num(c.newVisitors)} new`} />
            <Stat label="Page views" value={num(c.pageviews)} d={delta(c.pageviews, p.pageviews)} hint={`${perSession(c).toFixed(1)} per visit`} />
            <Stat label="Visits" value={num(c.sessions)} d={delta(c.sessions, p.sessions)} hint={`avg ${duration(c.avgSessionSec)}`} />
            <Stat label="Bounce rate" value={`${Math.round(bounce(c))}%`} d={delta(bounce(c), bounce(p), true)} hint="one page, then left" />
            <Stat label="New sign-ups" value={num(c.signups)} d={delta(c.signups, p.signups)} hint={`${num(a.users)} accounts total`} />
            <Stat label="Signed-in visitors" value={num(c.signedIn)} d={delta(c.signedIn, p.signedIn)} />
            <Stat label="Bottles watched" value={num(c.watches)} d={delta(c.watches, p.watches)} hint="added to watchlists" />
            <Stat
              label="Visitor → sign-up"
              value={c.visitors ? `${((c.signups / c.visitors) * 100).toFixed(1)}%` : "—"}
              hint="sign-ups ÷ visitors"
            />
          </div>
          <p className="text-xs text-subtle-foreground">Changes are {vs}. Your own visits aren&apos;t counted.</p>
          <div className="rounded-lg border bg-card p-5">
            <TrendChart points={d.points} hourly={d.hourly} />
          </div>
        </div>
      </section>

      <Section id="traffic" title="Where visitors come from">
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Channels" note="visits">
            <BarList rows={d.channels} />
          </Panel>
          <Panel title="Sources" note="visits">
            <BarList rows={d.sources} />
          </Panel>
          <Panel title="Referring sites" note="visits">
            <BarList rows={d.referrers} empty="No referring sites yet." />
          </Panel>
          <Panel title="Campaigns" note="utm_source / medium / campaign">
            <BarList rows={d.campaigns} empty="No tagged links yet. Add ?utm_source=… to links you share." />
          </Panel>
        </div>
      </Section>

      <Section id="content" title="What they look at">
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Top pages" note="views">
            <BarList rows={d.pages} />
          </Panel>
          <Panel title="Top bottles" note="views">
            <BarList rows={d.products} empty="No product views yet." />
          </Panel>
          <Panel title="Top searches" note="searches">
            <BarList rows={d.searches} empty="No searches yet." />
          </Panel>
          <Panel title="Landing pages" note="first page of a visit">
            <BarList rows={d.landings} />
          </Panel>
        </div>
      </Section>

      <Section id="audience" title="Who they are">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Panel title="Cities" note="visitors">
            <BarList rows={d.cities} empty="City shows up in production (Vercel geo)." />
          </Panel>
          <Panel title="Devices" note="visitors">
            <BarList rows={d.devices} />
          </Panel>
          <Panel title="Browsers" note="visitors">
            <BarList rows={d.browsers} />
          </Panel>
          <Panel title="Countries" note="visitors">
            <BarList rows={d.countries} />
          </Panel>
          <Panel title="Time of day" note="views by hour" className="md:col-span-2">
            <HourStrip counts={d.byHour} />
          </Panel>
        </div>
      </Section>

      <Section id="users" title="Accounts & alerts">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Accounts" value={num(a.users)} hint={`+${num(a.newUsers)} in range`} />
          <Stat label="Signed in, last 7 days" value={num(a.active7d)} hint={`${num(a.active30d)} in 30 days`} />
          <Stat label="Watching bottles" value={num(a.watchers)} hint={`${num(a.watchItems)} bottles total`} />
          <Stat label="Home stores set" value={num(a.withStores)} hint="get “back at my store” alerts" />
          <Stat label="Drop-day alerts on" value={num(a.dropAlerts)} hint="allocated list emails" />
          <Stat label="Alert emails sent" value={num(a.alertsSent)} hint={`to ${num(a.alertedUsers)} people, in range`} />
          <Stat label="Watchlist emails off" value={num(a.watchAlertsOff)} />
          <Stat label="Old footer sign-ups" value={num(a.legacySignups)} hint="email_signups list" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <Panel title="Newest accounts">
            {a.recent.length ? (
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-subtle-foreground">
                    <tr>
                      <th className="px-2 pb-2 font-normal">Email</th>
                      <th className="px-2 pb-2 font-normal">Joined</th>
                      <th className="px-2 pb-2 font-normal">Last in</th>
                      <th className="px-2 pb-2 text-right font-normal">Watching</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.recent.map((u) => (
                      <tr key={u.email} className="border-t">
                        <td className="max-w-56 truncate px-2 py-2" title={u.stores ? `Home stores: ${u.stores}` : undefined}>
                          {u.email}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">{shortDate(u.createdAt)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">{ago(u.lastSignIn)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{u.watching}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-subtle-foreground">No accounts yet.</p>
            )}
          </Panel>
          <Panel title="Most-watched bottles" note="watchers">
            <BarList rows={a.watched} empty="Nobody is watching anything yet." />
          </Panel>
        </div>
      </Section>

      <Section id="ratings" title="Ratings (beta)">
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <Panel title="Watchlist adds per product viewer" note="viewer = one visitor on one bottle page">
            {rb.groups.length ? (
              <div className="-mx-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-subtle-foreground">
                    <tr>
                      <th className="px-2 pb-2 font-normal">Badge</th>
                      <th className="px-2 pb-2 text-right font-normal">Bottles viewed</th>
                      <th className="px-2 pb-2 text-right font-normal">Viewers</th>
                      <th className="px-2 pb-2 text-right font-normal">Adds</th>
                      <th className="px-2 pb-2 text-right font-normal">Adds / 100 viewers</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rb.groups.map((g) => (
                      <tr key={g.tier} className="border-t">
                        <td className="px-2 py-2 capitalize">{g.tier}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{num(g.products)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{num(g.viewers)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{num(g.adds)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {g.viewers ? ((100 * g.adds) / g.viewers).toFixed(1) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-2 pt-3 text-xs text-subtle-foreground">
                  Rare bottles draw more interested people anyway, so a higher rate isn&apos;t proof the badge caused it.
                </p>
              </div>
            ) : (
              <p className="text-sm text-subtle-foreground">No bottle views in range.</p>
            )}
          </Panel>
          <Panel title="“Rating seems wrong” notes" note="newest first">
            {rb.feedback.length ? (
              <ul className="divide-y text-sm">
                {rb.feedback.map((f) => (
                  <li key={f.createdAt.toString() + f.csc} className="space-y-1 py-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link prefetch={false} href={`/product/${f.csc}`} className="truncate font-medium hover:underline">
                        {f.name ?? f.csc}
                      </Link>
                      <span className="shrink-0 text-xs text-subtle-foreground">
                        {f.tier ?? "not rated"} · {shortDate(f.createdAt)}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{f.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-subtle-foreground">No notes yet.</p>
            )}
          </Panel>
        </div>
      </Section>

      <Section id="data" title="Data freshness">
        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="Jobs" note="last success">
            <ul className="divide-y text-sm">
              {a.jobs.map((j) => {
                const limit = JOB_MAX_AGE_HOURS[j.job];
                const stale = limit != null && (!j.lastOk || d.now.getTime() - new Date(j.lastOk).getTime() > limit * 3_600_000);
                return (
                  <li key={j.job} className="flex items-center gap-3 py-2">
                    <span className={cn("size-2 rounded-full", stale ? "bg-destructive" : "bg-success")} aria-hidden />
                    <span className="flex-1">{j.job.replace(/_/g, " ")}</span>
                    {j.fails24h > 0 && (
                      <span className="text-xs text-destructive">
                        {j.fails24h}/{j.runs24h} failed today
                      </span>
                    )}
                    <span className={cn("tabular-nums", stale ? "text-destructive" : "text-muted-foreground")}>
                      {stale ? "stale · " : ""}
                      {ago(j.lastOk)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
          <Panel title="Inventory changes" note="in range">
            <BarList rows={a.events.map((e) => ({ ...e, label: e.label.replace(/_/g, " ") }))} empty="No changes in range." />
            <p className="mt-4 text-xs text-subtle-foreground">
              {num(a.products)} listed products · {num(a.inStock)} in stock · {num(a.stores)} stores
            </p>
          </Panel>
        </div>
      </Section>
    </div>
  );
}
