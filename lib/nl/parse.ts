import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { sql } from "@/lib/db";

/**
 * LLM as query translator, never as data source. One cheap Haiku call turns
 * the user's words into a strict filter object; everything after that is
 * plain SQL against our own database. Zero hallucination surface.
 */

export const ParsedQuery = z.object({
  categories: z.array(z.string()).default([]),
  name_terms: z.array(z.string()).default([]),
  price_min: z.number().nullable().default(null),
  price_max: z.number().nullable().default(null),
  price_tier: z
    .enum(["top_quartile", "above_median", "below_median", "bottom_quartile", "any"])
    .default("any"),
  status_filter: z.enum(["in_stock", "any", "discontinued_clearance", "allocated"]).default("in_stock"),
  location_text: z.string().nullable().default(null),
  sort: z.enum(["relevance", "price_asc", "price_desc", "qty"]).default("relevance"),
  limit: z.number().int().min(1).max(25).default(10),
});
export type ParsedQuery = z.infer<typeof ParsedQuery>;

let taxonomyCache: { categories: string[]; at: number } | null = null;

async function getTaxonomy(): Promise<string[]> {
  if (taxonomyCache && Date.now() - taxonomyCache.at < 3600_000) {
    return taxonomyCache.categories;
  }
  const rows = (await sql`
    select distinct category from products
    where category is not null and not category like 'SPECIAL ORDERS%'
    order by category`) as unknown as { category: string }[];
  taxonomyCache = { categories: rows.map((r) => r.category), at: Date.now() };
  return taxonomyCache.categories;
}

const parseCache = new Map<string, ParsedQuery>();

export async function parseQuery(query: string): Promise<ParsedQuery | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const cacheKey = query.trim().toLowerCase();
  const cached = parseCache.get(cacheKey);
  if (cached) return cached;

  const taxonomy = await getTaxonomy();
  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: [
        "You translate natural-language liquor searches into filters for a Utah DABS inventory database.",
        "Rules:",
        "- categories: pick ONLY exact strings from the provided taxonomy. Pick every category that plausibly matches (e.g. 'whiskey' matches all WHISKEY - * categories). Leave empty if the query isn't category-specific.",
        "- name_terms: ONLY explicit brand/product words the user named (e.g. 'eagle rare' → ['eagle rare']). Never add descriptive adjectives like 'peaty' or 'high end' here.",
        "- price_tier: 'high end'/'premium'/'fancy' → top_quartile; 'cheap'/'budget' → bottom_quartile.",
        "- price_min/price_max: only when the user gives actual dollar amounts ('under $60' → price_max 60).",
        "- status_filter: in_stock unless the user asks about discontinued/clearance (discontinued_clearance) or allocated/rare bottles (allocated), or explicitly wants everything (any).",
        "- location_text: a place name to search near ('near Daybreak' → 'Daybreak'; 'near me' → 'NEAR_ME'). Null if no location mentioned.",
        "- 'peaty scotch' → the SCOTCH categories; 'bubbly' → sparkling/champagne categories; think category, not name.",
        "",
        "Category taxonomy:",
        taxonomy.join("\n"),
      ].join("\n"),
      messages: [{ role: "user", content: query }],
      tools: [
        {
          name: "emit_query",
          description: "Emit the structured search filters",
          input_schema: {
            type: "object" as const,
            properties: {
              categories: { type: "array", items: { type: "string" } },
              name_terms: { type: "array", items: { type: "string" } },
              price_min: { type: ["number", "null"] },
              price_max: { type: ["number", "null"] },
              price_tier: {
                type: "string",
                enum: ["top_quartile", "above_median", "below_median", "bottom_quartile", "any"],
              },
              status_filter: {
                type: "string",
                enum: ["in_stock", "any", "discontinued_clearance", "allocated"],
              },
              location_text: { type: ["string", "null"] },
              sort: { type: "string", enum: ["relevance", "price_asc", "price_desc", "qty"] },
              limit: { type: "integer" },
            },
            required: ["categories", "name_terms", "price_tier", "status_filter"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "emit_query" },
    });

    const toolUse = message.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;
    const parsed = ParsedQuery.safeParse(toolUse.input);
    if (!parsed.success) return null;

    // Discard hallucinated categories — only exact taxonomy strings survive.
    const taxonomySet = new Set(taxonomy);
    const result = {
      ...parsed.data,
      categories: parsed.data.categories.filter((c) => taxonomySet.has(c)),
    };
    parseCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error("NL parse failed:", err);
    return null;
  }
}
