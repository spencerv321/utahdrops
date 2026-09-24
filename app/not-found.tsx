import Link from "next/link";
import { SearchBox } from "@/components/search-box";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl space-y-5 pt-6 sm:pt-12">
      <h1 className="text-5xl leading-none">We couldn&apos;t find that</h1>
      <p className="text-muted-foreground">
        The page or bottle isn&apos;t here. DABS sometimes renumbers or drops products. Try searching
        by name instead.
      </p>
      <SearchBox examples />
      <Link prefetch={false} href="/" className="inline-flex min-h-11 items-center underline underline-offset-4">
        Back to home
      </Link>
    </div>
  );
}
