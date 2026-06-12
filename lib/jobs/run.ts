import { sql } from "@/lib/db";

export interface JobResult {
  ok: boolean;
  detail: Record<string, unknown>;
}

/** Wrap a job with scrape_runs bookkeeping; rethrows after recording failure. */
export async function withRun(
  job: string,
  fn: () => Promise<Record<string, unknown>>
): Promise<JobResult> {
  const [run] = await sql<{ id: number }[]>`
    insert into scrape_runs (job) values (${job}) returning id`;
  try {
    const detail = await fn();
    await sql`
      update scrape_runs
      set finished_at = now(), ok = true, detail = ${sql.json(detail as never)}
      where id = ${run.id}`;
    return { ok: true, detail };
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    await sql`
      update scrape_runs
      set finished_at = now(), ok = false, detail = ${sql.json({ error: message })}
      where id = ${run.id}`;
    throw err;
  }
}

export async function lastSuccessfulRun(job: string): Promise<Date | null> {
  const rows = await sql<{ started_at: Date }[]>`
    select started_at from scrape_runs
    where job = ${job} and ok = true
    order by started_at desc limit 1`;
  return rows[0]?.started_at ?? null;
}
