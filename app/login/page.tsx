import type { Metadata } from "next";
import { Bell, CalendarDays, Star } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { WatchSignIn } from "@/components/watch-sign-in";
import { getProduct } from "@/lib/queries";
import { sql } from "@/lib/db";
import { peekWatchIntent } from "@/lib/watch-intent";
import { productTitle, sizeLabel, storeLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Sign in" };

const LINK_HELP =
  "That sign-in link didn't work. Links work once, for an hour, and in the browser you asked from. Enter your email for a fresh one.";

/**
 * The bottle a signed-out visitor asked to watch: from ?watch=<code>, or from
 * a failed watch link (next=/watch/confirm?intent=…), so a fresh link keeps
 * the same request. Only shown here; nothing is saved until they submit.
 */
async function watchRequest(watch?: string, store?: string, next?: string) {
  let csc = watch && /^\d{6}$/.test(watch) ? watch : null;
  let storeId = store && /^\d{1,5}$/.test(store) ? Number(store) : null;
  const intentId = next?.match(/^\/watch\/confirm\?intent=([0-9a-f-]{36})$/i)?.[1];
  if (!csc && intentId) {
    const intent = await peekWatchIntent(intentId);
    if (intent) ({ csc, storeId } = intent);
  }
  if (!csc) return null;
  const product = await getProduct(csc);
  if (!product) return null;
  return { product, storeId };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; watch?: string; store?: string; src?: string }>;
}) {
  const { next, error, watch, store, src } = await searchParams;
  const request = await watchRequest(watch, store, next);

  if (request) {
    const { product, storeId } = request;
    const name = productTitle(product.name, product.size_ml);
    const stores = (await sql`select id, name, city from stores order by city nulls last, name`) as unknown as {
      id: number;
      name: string;
      city: string | null;
    }[];
    const options = stores.map((s) => {
      const l = storeLabel(s.name, s.city);
      return { id: s.id, label: l.number ? `${l.title} (#${l.number})` : l.title };
    });
    return (
      <div className="mx-auto max-w-md space-y-6 pt-4 sm:pt-12">
        <div className="space-y-2">
          <p className="kicker text-muted-foreground">Watch a bottle</p>
          <h1 className="font-sans text-[1.75rem] leading-tight font-medium tracking-[-0.015em]">
            {name} <span className="text-muted-foreground">{sizeLabel(product.size_ml)}</span>
          </h1>
          <p className="text-muted-foreground">
            {product.in_stock ? "In stores now. " : "Not in stores right now. "}
            Free, no password: we email you a link, and once you tap it you&apos;re watching.
          </p>
        </div>
        {error === "link" && (
          <p role="alert" className="rounded-md border border-destructive/40 px-4 py-3 text-sm">
            {LINK_HELP} Your bottle choice is kept.
          </p>
        )}
        <WatchSignIn
          csc={product.csc}
          productName={name}
          stores={options}
          initialStoreId={options.some((o) => o.id === storeId) ? storeId : null}
          source={src === "taste" ? "taste" : null}
        />
        <p className="text-xs text-muted-foreground">
          We only email you about bottles and drops you ask about. Not affiliated with DABS.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 pt-4 sm:pt-12">
      <div className="space-y-2">
        <h1 className="text-5xl leading-none">Get alerts, free</h1>
        <p className="text-muted-foreground">
          No password. We email you a link, and you&apos;re in.
        </p>
      </div>
      <ul className="divide-y border-y text-[15px]">
        <li className="flex gap-3 py-3">
          <Star className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          Watch any bottle and get an email when it&apos;s back.
        </li>
        <li className="flex gap-3 py-3">
          <Bell className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          Pick your store and hear when it&apos;s back there.
        </li>
        <li className="flex gap-3 py-3">
          <CalendarDays className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          Hear when the allocated list posts.
        </li>
      </ul>
      {error === "link" && (
        <p role="alert" className="rounded-md border border-destructive/40 px-4 py-3 text-sm">
          {LINK_HELP}
        </p>
      )}
      <LoginForm next={next ?? "/"} />
      <p className="text-xs text-muted-foreground">
        We only email you about bottles and drops you ask about. Not affiliated with DABS.
      </p>
    </div>
  );
}
