"use client";

import Link from "next/link";
import { sendDiscoverEvent } from "@/lib/beacon";

/** A link counted as a click for its source (a bottle when `csc` is set). */
export function DiscoverLink({
  href,
  csc,
  source,
  className,
  children,
}: {
  href: string;
  csc?: string | null;
  source: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link prefetch={false} href={href} className={className} onClick={() => sendDiscoverEvent("click", source, csc)}>
      {children}
    </Link>
  );
}
