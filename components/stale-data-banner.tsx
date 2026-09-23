import { getDataStaleness } from "@/lib/queries";
import { formatAsOf } from "@/lib/format";

/** Tells visitors plainly when inventory data has stopped refreshing. */
export async function StaleDataBanner() {
  const { freshness, stale } = await getDataStaleness(24);
  if (!stale) return null;
  return (
    <div role="status" className="border-b border-warning/40 bg-warning/15 px-4 py-2 text-center text-sm">
      Heads up: inventory data hasn&apos;t refreshed since {formatAsOf(freshness)} MT.
      Always confirm with the store or the official DABS locator.
    </div>
  );
}
