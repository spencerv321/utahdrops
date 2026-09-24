import { getDataStaleness } from "@/lib/queries";
import { formatAsOf } from "@/lib/format";

/** Tells visitors plainly when inventory data has stopped refreshing. */
export async function StaleDataBanner() {
  const { freshness, stale } = await getDataStaleness(24);
  if (!stale) return null;
  return (
    <div role="status" className="border-b border-warning/40 px-4 py-2 text-center text-sm text-warning">
      DABS numbers haven&apos;t updated since {formatAsOf(freshness)} MT. Call the store before you drive.
    </div>
  );
}
