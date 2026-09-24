import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { releaseIdleConnections } from "@/lib/db-release";
import { JOB_MAX_AGE_HOURS as MAX_AGE_HOURS } from "@/lib/config";

/**
 * Freshness check for uptime monitors: 503 when any job's last success is
 * older than its budget (roughly 2–3× its schedule). Point a free monitor
 * (Better Stack, UptimeRobot, Healthchecks.io) at this URL.
 */
export async function GET() {
  releaseIdleConnections();
  const rows = (await sql`
    select job, max(finished_at) as last_ok
    from scrape_runs
    where ok = true and job = any(${Object.keys(MAX_AGE_HOURS)})
    group by job`) as unknown as { job: string; last_ok: Date }[];
  const lastOk = new Map(rows.map((r) => [r.job, r.last_ok]));

  const jobs = Object.entries(MAX_AGE_HOURS).map(([job, maxHours]) => {
    const at = lastOk.get(job) ?? null;
    const ageHours = at ? (Date.now() - at.getTime()) / 3600_000 : null;
    return {
      job,
      last_ok: at,
      age_hours: ageHours == null ? null : Math.round(ageHours * 10) / 10,
      stale: ageHours == null || ageHours > maxHours,
    };
  });
  const ok = jobs.every((j) => !j.stale);
  return NextResponse.json({ ok, jobs }, { status: ok ? 200 : 503 });
}
