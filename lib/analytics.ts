/**
 * Helpers for first-party page-view tracking (see app/api/events/route.ts).
 * Everything here is pure so the route stays short.
 */

const BOT_UA =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora link|whatsapp|telegram|discordbot|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch|go-http|java\//i;

export function isBot(ua: string): boolean {
  return !ua || BOT_UA.test(ua);
}

export function deviceOf(ua: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}

export function browserOf(ua: string): string {
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\/|opera/i.test(ua)) return "Opera";
  if (/samsungbrowser/i.test(ua)) return "Samsung Internet";
  if (/fbav|fban|instagram/i.test(ua)) return "In-app (Meta)";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/chrome|crios/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  return "Other";
}

export function osOf(ua: string): string {
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/windows/i.test(ua)) return "Windows";
  if (/mac os x|macintosh/i.test(ua)) return "macOS";
  if (/cros/i.test(ua)) return "ChromeOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Other";
}

/** "https://www.google.com/search?q=…" → "google.com". Null for our own site. */
export function referrerHost(raw: string | null | undefined, ownHost: string): string | null {
  if (!raw) return null;
  try {
    let host = new URL(raw).hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    if (host.startsWith("m.") || host.startsWith("l.") || host.startsWith("lm.")) {
      host = host.slice(host.indexOf(".") + 1);
    }
    const own = ownHost.replace(/^www\./, "");
    if (!host || host === own || host.endsWith(`.${own}`) || host === "localhost") return null;
    return host;
  } catch {
    return null;
  }
}

const SOURCES: [RegExp, string][] = [
  [/(^|\.)google\./, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)yahoo\./, "Yahoo"],
  [/(^|\.)(chatgpt\.com|openai\.com)$/, "ChatGPT"],
  [/perplexity\.ai$/, "Perplexity"],
  [/claude\.ai$/, "Claude"],
  [/gemini\.google\.com$/, "Gemini"],
  [/copilot\.microsoft\.com$/, "Copilot"],
  [/reddit\.com$|redd\.it$/, "Reddit"],
  [/facebook\.com$|fb\.com$|fb\.me$/, "Facebook"],
  [/instagram\.com$/, "Instagram"],
  [/^t\.co$|(^|\.)(x|twitter)\.com$/, "X / Twitter"],
  [/threads\.net$/, "Threads"],
  [/tiktok\.com$/, "TikTok"],
  [/youtube\.com$|youtu\.be$/, "YouTube"],
  [/linkedin\.com$|lnkd\.in$/, "LinkedIn"],
  [/pinterest\./, "Pinterest"],
  [/discord\.(com|gg)$/, "Discord"],
  [/bsky\.app$/, "Bluesky"],
  [/mail\.|outlook\.|proton\.me$/, "Email"],
];

/** Friendly channel name for the dashboard; utm_source beats the referrer. */
export function sourceOf(host: string | null, utmSource: string | null): string {
  const probe = (utmSource ?? "").toLowerCase();
  if (probe) {
    if (/e-?mail|newsletter|digest|resend/.test(probe)) return "Email";
    for (const [re, name] of SOURCES) if (re.test(probe)) return name;
    if (probe.includes(".")) return probe.replace(/^www\./, "");
    return probe.charAt(0).toUpperCase() + probe.slice(1);
  }
  if (!host) return "Direct";
  for (const [re, name] of SOURCES) if (re.test(host)) return name;
  return host;
}

/** Channel family for the source, used to group the traffic panel. */
export const SOURCE_KIND: Record<string, "Search" | "AI" | "Social" | "Email" | "Direct"> = {
  Google: "Search",
  Bing: "Search",
  DuckDuckGo: "Search",
  Yahoo: "Search",
  ChatGPT: "AI",
  Perplexity: "AI",
  Claude: "AI",
  Gemini: "AI",
  Copilot: "AI",
  Reddit: "Social",
  Facebook: "Social",
  Instagram: "Social",
  "X / Twitter": "Social",
  Threads: "Social",
  TikTok: "Social",
  YouTube: "Social",
  LinkedIn: "Social",
  Pinterest: "Social",
  Discord: "Social",
  Bluesky: "Social",
  Email: "Email",
  Direct: "Direct",
};
