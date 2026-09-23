import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;

const JOBS: Record<string, (params: URLSearchParams) => Promise<unknown>> = {
  catalog: () => import("@/lib/jobs/catalog").then((m) => m.runCatalogJob()),
  "store-inventory": () =>
    import("@/lib/jobs/store-inventory").then((m) => m.runStoreInventoryJob()),
  allocated: () => import("@/lib/jobs/allocated").then((m) => m.runAllocatedJob()),
  xlsx: () => import("@/lib/jobs/xlsx").then((m) => m.runXlsxJob()),
  percentiles: () => import("@/lib/jobs/percentiles").then((m) => m.runPercentilesJob()),
  digest: () => import("@/lib/jobs/digest").then((m) => m.runDigestJob()),
  // One-time: dry run unless ?send=1
  "invite-signups": (params) =>
    import("@/lib/jobs/invite-signups").then((m) => m.runInviteSignupsJob(params.get("send") === "1")),
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ job: string }> }
) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { job } = await params;
  const run = JOBS[job];
  if (!run) {
    return NextResponse.json({ error: "unknown_job" }, { status: 404 });
  }

  try {
    const result = await run(request.nextUrl.searchParams);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    // scrape_runs already recorded the failure; surface it for cron logs
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
