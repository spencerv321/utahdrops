import Anthropic from "@anthropic-ai/sdk";
import { sql } from "@/lib/db";
import { TAGS, type Tag } from "@/lib/taste/profile";
import { BODY_PREFS, SWEET_PREFS, WINE_TYPES, type TasteRequest } from "@/lib/taste/request";
import type { TypedParse } from "@/lib/taste/parse";

/**
 * Optional model step for typed wine requests. The rules in parse.ts come
 * first; the model only reads the words they couldn't use ("for a barbecue
 * with friends") and may fill preferences they left empty, from the same
 * small vocabulary. It never sets price, place, wine type or grape (those
 * are hard constraints, taken only from the rules or the URL), never names
 * products, and has a hard time limit. Failure = the rules' reading stands.
 */
export const INTERPRET_MODEL = "claude-haiku-4-5-20251001";
export const INTERPRET_TIMEOUT_MS = 2500;
/** Haiku 4.5 list prices, USD per million tokens (input, output). */
export const HAIKU_PRICE_PER_MTOK = { input: 1, output: 5 };

export interface ModelAddition {
  sweet?: TasteRequest["sweet"];
  body?: TasteRequest["body"];
  tags?: Tag[];
  /** Words the model says it used, for the chip ("from 'barbecue'"). */
  words?: string;
}

const cache = new Map<string, ModelAddition | null>();

export function shouldInterpret(typed: TypedParse): boolean {
  return !!process.env.ANTHROPIC_API_KEY && typed.wineish && typed.unused.length > 0;
}

/** Fill only what the rules left empty, from the allowed values. */
export function mergeModel(typed: TypedParse, add: ModelAddition | null): TypedParse {
  if (!add) return typed;
  const request = { ...typed.request, tags: [...typed.request.tags] };
  const origin = { ...typed.origin };
  const phrases = { ...typed.phrases };
  const words = add.words?.slice(0, 60) ?? "your words";
  if (!request.sweet && add.sweet && SWEET_PREFS.includes(add.sweet)) {
    request.sweet = add.sweet;
    origin.sweet = "model";
    phrases.sweet = words;
  }
  if (!request.body && add.body && BODY_PREFS.includes(add.body)) {
    request.body = add.body;
    origin.body = "model";
    phrases.body = words;
  }
  const newTags = (add.tags ?? []).filter((t) => TAGS.includes(t) && !request.tags.includes(t));
  if (newTags.length && request.tags.length < 4) {
    request.tags = [...request.tags, ...newTags].slice(0, 4);
    origin.tags = typed.origin.tags ?? "model";
    phrases.tags = phrases.tags ? `${phrases.tags}, ${words}` : words;
  }
  const changed = request.sweet !== typed.request.sweet || request.body !== typed.request.body || request.tags.length !== typed.request.tags.length;
  const unused = changed ? typed.unused.filter((w) => !words.toLowerCase().includes(w)) : typed.unused;
  const isTaste = typed.isTaste || (typed.wineish && changed);
  return { ...typed, request, origin, phrases, unused, isTaste };
}

export async function interpretWithModel(q: string, typed: TypedParse): Promise<ModelAddition | null> {
  const key = q.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  const started = Date.now();
  let usage: { input_tokens: number; output_tokens: number } | null = null;
  let result: ModelAddition | null = null;
  try {
    const client = new Anthropic();
    const message = await client.messages.create(
      {
        model: INTERPRET_MODEL,
        max_tokens: 200,
        system: [
          "You map a wine shopper's words to taste preferences for a store search.",
          "Only use the allowed values. Leave a field out unless the words clearly imply it.",
          "Do not guess prices, places, grapes or wine colors. Never name products.",
          `Already understood: ${JSON.stringify({ type: typed.request.type, sweet: typed.request.sweet, body: typed.request.body, tags: typed.request.tags })}.`,
          `Words not yet understood: ${JSON.stringify(typed.unused)}.`,
        ].join("\n"),
        messages: [{ role: "user", content: q.slice(0, 300) }],
        tools: [
          {
            name: "emit_preferences",
            description: "Taste preferences implied by the words not yet understood",
            input_schema: {
              type: "object" as const,
              properties: {
                sweet: { type: "string", enum: SWEET_PREFS },
                body: { type: "string", enum: BODY_PREFS },
                tags: { type: "array", items: { type: "string", enum: TAGS }, maxItems: 3 },
                words: { type: "string", description: "The shopper's words these came from" },
              },
            },
          },
        ],
        tool_choice: { type: "tool", name: "emit_preferences" },
      },
      { timeout: INTERPRET_TIMEOUT_MS, maxRetries: 0 }
    );
    usage = message.usage;
    const block = message.content.find((b) => b.type === "tool_use");
    if (block && block.type === "tool_use") result = block.input as ModelAddition;
  } catch (err) {
    console.error("[taste] interpret failed:", err instanceof Error ? err.message : err);
  }
  const ms = Date.now() - started;
  cache.set(key, result);
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  // Latency, tokens and success, for report.yml → taste (no visitor data).
  await sql`
    insert into taste_events (kind, request, model_ms, input_tokens, output_tokens, model_ok)
    values ('interpret', ${sql.json({ types: WINE_TYPES.includes(typed.request.type as never) ? typed.request.type : null, unused: typed.unused.length } as never)},
            ${ms}, ${usage?.input_tokens ?? null}, ${usage?.output_tokens ?? null}, ${result != null})`.catch(() => {});
  return result;
}
