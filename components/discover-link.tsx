"use client";

import Link from "next/link";
import { sendDiscoverEvent } from "@/lib/beacon";

/** A link from a "Worth a look" result to a bottle, counted as a product click. */
export function DiscoverLink({
  href,
  csc,
  source,
  className,
  children,
}: {
  href: string;
  csc: string;
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
