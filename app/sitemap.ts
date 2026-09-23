import type { MetadataRoute } from "next";
import { sql } from "@/lib/db";
import { SITE_URL } from "@/lib/config";

// Rendered per request (not at build time, when there's no database). ~30k
// URLs fits under the 50k-per-sitemap limit.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = (await sql`
    select csc, last_seen from products
    where delisted_at is null
      and (category is null or category not like 'SPECIAL ORDERS%')
    order by csc`) as unknown as { csc: string; last_seen: Date }[];

  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/search`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/drops`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/whats-new`, changeFrequency: "hourly", priority: 0.8 },
  ];
  return [
    ...pages,
    ...products.map((p) => ({
      url: `${SITE_URL}/product/${p.csc}`,
      lastModified: p.last_seen,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
