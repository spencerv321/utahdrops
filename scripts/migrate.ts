import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
config({ path: ".env.local" });

/**
 * Applies pending supabase/migrations/*.sql files to DATABASE_URL, each in its
 * own transaction, and records them in public.app_migrations. Runs from the
 * migrate workflow on every push to main.
 *
 * Baseline: a database that already has the initial schema (the `products`
 * table exists) gets the initial migration recorded without re-running it.
 */
const DIR = "supabase/migrations";

async function main() {
  const { sql } = await import("../lib/db");
  await sql`
    create table if not exists public.app_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`;
  await sql`alter table public.app_migrations enable row level security`;

  const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
  const applied = new Set(
    (await sql<{ name: string }[]>`select name from public.app_migrations`).map((r) => r.name)
  );

  const [{ has_schema }] = await sql<{ has_schema: boolean }[]>`
    select to_regclass('public.products') is not null as has_schema`;
  if (has_schema && !applied.has(files[0])) {
    await sql`insert into public.app_migrations (name) values (${files[0]})`;
    applied.add(files[0]);
    console.log(`baseline: recorded ${files[0]} (schema already present)`);
  }

  for (const file of files) {
    if (applied.has(file)) continue;
    const body = readFileSync(join(DIR, file), "utf8");
    console.log(`applying ${file}…`);
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into public.app_migrations (name) values (${file})`;
    });
    console.log(`applied ${file}`);
  }
  console.log("migrations up to date");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
