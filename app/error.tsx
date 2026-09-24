"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { SearchBox } from "@/components/search-box";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl space-y-5 pt-6 sm:pt-12">
      <h1 className="text-4xl leading-none">That didn&apos;t load</h1>
      <p className="text-muted-foreground">
        Something went wrong on our end. Try again, or search for what you were after.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="h-12 rounded-xl bg-primary px-5 font-bold text-primary-foreground"
        >
          Try again
        </button>
        <Link href="/" className="inline-flex h-12 items-center rounded-xl border bg-card px-5 font-bold">
          Go home
        </Link>
      </div>
      <SearchBox />
    </div>
  );
}
