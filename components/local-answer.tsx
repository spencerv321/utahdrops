import { Check, Navigation, Phone } from "lucide-react";
import { nearLabel, type Area } from "@/lib/area";
import type { LocalAnswer, StoreHit } from "@/lib/local-availability";
import { wantsLiveCheck } from "@/lib/local-availability";
import { checkedAgo, formatQty, storeLabel, whenLabel } from "@/lib/format";
import { AreaPicker } from "@/components/area-picker";
import { CheckDabsButton } from "@/components/check-dabs-button";
import { cn } from "@/lib/utils";

type Unit = { one: string; many: string };

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
const mapHref = (s: StoreHit) =>
  s.lat != null
    ? `https://maps.google.com/?q=${s.lat},${s.lng}`
    : `https://maps.google.com/?q=${encodeURIComponent([s.address, s.city, "UT"].filter(Boolean).join(", "))}`;

function storeName(s: StoreHit): string {
  const l = storeLabel(s.name, s.city);
  return l.number ? `${l.title} #${l.number}` : l.title;
}

/**
 * "Is it near me?" directly under the price: the chosen area (the same
 * ud_area cookie search uses, changeable here), an answer that only claims
 * what the data supports (lib/local-availability.ts), store-by-store and
 * statewide freshness on separate lines, and the action that fits: go (fresh
 * stock), check DABS now (old, unknown or contradicted counts; tap only), or
 * watch.
 */
export function LocalAnswerCard({
  answer,
  area,
  areas,
  unit,
  csc,
  statewide,
  watch,
}: {
  answer: LocalAnswer;
  area: Area | null;
  /** Every area with a state store, independent of this bottle's stock. */
  areas: Area[];
  unit: Unit;
  csc: string;
  statewide: { qty: number | null; at: Date | string; warehouseQty: number | null; drawingPrice: boolean };
  /** The Watch button and its note, rendered by the page. */
  watch: React.ReactNode;
}) {
  const where = area ? nearLabel(area) : null;
  const n = (q: number) => (q === 1 ? unit.one : unit.many);
  let headline: React.ReactNode;
  let detail: React.ReactNode = null;
  let tone: "good" | "caution" | "plain" = "plain";
  let go: StoreHit | null = null;

  switch (answer.kind) {
    case "no-area":
      headline = "Choose your area to see stores near you";
      detail = "Pick a city with a state store, or use your location. We'll remember it on this device.";
      break;
    case "delisted":
      headline = answer.drawing ? "Not currently listed" : "DABS no longer lists this bottle";
      detail = answer.drawing
        ? "DABS has released it through drawings, so there's no shelf stock to show."
        : "It may not come back, so there's no store stock to show.";
      tone = "caution";
      break;
    case "statewide-zero":
      // When DABS showed it is on the statewide line below.
      headline = "None on store shelves in Utah";
      detail =
        (statewide.warehouseQty ?? 0) > 0
          ? `${formatQty(statewide.warehouseQty)} at the DABS warehouse, which doesn't sell to the public.`
          : null;
      break;
    case "fresh-positive":
      tone = "good";
      go = answer.nearest;
      headline = (
        <>
          {formatQty(answer.units)} {n(answer.units)} at {answer.stores} {answer.stores === 1 ? "store" : "stores"} {where}
        </>
      );
      detail = `Nearest: ${storeName(answer.nearest)}, ${answer.nearest.miles.toFixed(1)} mi, ${answer.nearest.qty} ${n(answer.nearest.qty)}. Checked ${checkedAgo(answer.checkedAt)}.`;
      break;
    case "stale-positive":
      tone = "caution";
      go = answer.nearest;
      headline = (
        <>
          Last known: {formatQty(answer.units)} {n(answer.units)} at {answer.stores} {answer.stores === 1 ? "store" : "stores"} {where}
        </>
      );
      detail = `Checked ${whenLabel(answer.checkedAt)}, over a day ago, so it may have sold since. Check DABS now or call first.`;
      break;
    case "fresh-zero":
      headline = `None at stores ${where}`;
      detail = (
        <>
          When we checked {checkedAgo(answer.checkedAt)}.
          {answer.elsewhere
            ? ` Nearest with stock: ${storeName(answer.elsewhere)}, ${answer.elsewhere.miles.toFixed(0)} mi away (${answer.elsewhere.qty} ${n(answer.elsewhere.qty)}).`
            : " None at any store we check."}
        </>
      );
      break;
    case "disproved":
      tone = "caution";
      headline = `Store counts ${where} are out of date`;
      detail = `We counted stock there ${checkedAgo(answer.checkedAt)}, but DABS now shows fewer statewide. Check DABS now or call first.`;
      break;
    case "unknown":
      headline = answer.checkedAt ? `No recent check ${where ?? ""}`.trim() : "Not checked store by store yet";
      detail = answer.checkedAt
        ? `Last checked ${whenLabel(answer.checkedAt)}: too long ago to say either way.`
        : "We haven't seen this bottle on DABS's store-by-store page yet.";
      break;
  }

  const onShelves = (statewide.qty ?? 0) > 0;
  const statewideLine = statewide.drawingPrice
    ? "Price from its most recent DABS drawing."
    : `${onShelves ? `${formatQty(statewide.qty)} ${n(statewide.qty ?? 0)} on shelves` : "None on shelves"} statewide · DABS catalog ${whenLabel(statewide.at)}`;
  const storeLine =
    "checkedAt" in answer && answer.checkedAt ? `Store by store: checked ${whenLabel(answer.checkedAt)}` : null;

  return (
    <section aria-labelledby="local-title" className="space-y-4 rounded-lg bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="local-title" className="text-[15px] font-medium text-muted-foreground">
          Stock near
        </h2>
        <AreaPicker areas={areas} current={area} className="w-full rounded-md border border-input bg-raised sm:w-64" />
      </div>

      <div className="space-y-1.5" aria-live="polite">
        <p
          className={cn(
            "flex items-start gap-1.5 text-lg leading-snug font-medium",
            tone === "good" && "text-success",
            tone === "caution" && "text-warning"
          )}
        >
          {tone === "good" ? <Check className="mt-1 size-5 shrink-0" aria-hidden /> : null}
          <span className="min-w-0">{headline}</span>
        </p>
        {detail ? <p className="text-[15px] leading-relaxed text-muted-foreground">{detail}</p> : null}
      </div>

      {go ? (
        <div className="grid grid-cols-2 gap-2">
          <a
            href={mapHref(go)}
            target="_blank"
            rel="noopener"
            className="flex h-11 items-center justify-center gap-2 rounded-md border border-input text-[15px] hover:bg-raised"
          >
            <Navigation className="size-4" aria-hidden />
            Directions
          </a>
          {go.phone ? (
            <a
              href={telHref(go.phone)}
              className="flex h-11 items-center justify-center gap-2 rounded-md border border-input text-[15px] hover:bg-raised"
            >
              <Phone className="size-4" aria-hidden />
              Call first
            </a>
          ) : null}
        </div>
      ) : null}

      {wantsLiveCheck(answer) ? <CheckDabsButton csc={csc} /> : null}

      <dl className="space-y-0.5 text-[13px] text-subtle-foreground">
        {storeLine ? (
          <div>
            <dt className="sr-only">Store-by-store counts</dt>
            <dd>{storeLine}</dd>
          </div>
        ) : null}
        <div>
          <dt className="sr-only">Statewide</dt>
          <dd>{statewideLine}</dd>
        </div>
      </dl>

      <div className="border-t pt-4">{watch}</div>
    </section>
  );
}
