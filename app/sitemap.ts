import type { MetadataRoute } from "next";
import { sql } from "@/lib/db";
import { SITE_URL } from "@/lib/config";
import { ARTICLES, UTAH_101_PATH, articlePath } from "@/lib/utah-101";
import { MAKERS, MAKERS_PATH, makerChecked, makerPath } from "@/lib/makers";

// Rendered per request (not at build time, when there's no database). ~30k
// URLs fits under the 50k-per-sitemap limit.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // lastmod = the bottle's latest real change (restock, price, status…), not
  // last_seen, which moves on every catalog pass and taught crawlers to ignore it.
  const products = (await sql`
    select p.csc,
           coalesce((select max(e.created_at) from inventory_events e where e.csc = p.csc), p.first_seen) as changed_at
    from products p
    where p.delisted_at is null
      and (p.category is null or p.category not like 'SPECIAL ORDERS%')
    order by p.csc`) as unknown as { csc: string; changed_at: Date }[];

  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/search`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/discover`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE_URL}/drops`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/drawings`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/whats-new`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}${UTAH_101_PATH}`, changeFrequency: "monthly", priority: 0.8 },
    ...ARTICLES.map((a) => ({
      url: `${SITE_URL}${articlePath(a.slug)}`,
      lastModified: new Date(a.checked + "T12:00:00Z"),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}${MAKERS_PATH}`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/bars`, changeFrequency: "weekly", priority: 0.8 },
    ...MAKERS.map((m) => ({
      url: `${SITE_URL}${makerPath(m.slug)}`,
      lastModified: new Date(makerChecked(m) + "T12:00:00Z"),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
  return [
    ...pages,
    ...products.map((p) => ({
      url: `${SITE_URL}/product/${p.csc}`,
      lastModified: p.changed_at,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
