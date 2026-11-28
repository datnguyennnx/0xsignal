export type ParsedDraft =
  | {
      kind: "price";
      symbol: string;
      op: "gte" | "lte";
      value: number;
    }
  | {
      kind: "calendar";
      currency: string;
      leadMinutes: number;
      impactMin: "medium" | "high";
    }
  | null;

const SYMBOL_PATTERN = /^[a-z0-9]{2,6}$/;
const AMOUNT_PATTERN = /^(\d+(?:\.\d+)?)([kmb])?$/;
const LEAD_PATTERN = /(\d+(?:\.\d+)?)\s*(minutes?|mins?|m|hours?|hrs?|h)\b/g;
const BEFORE_PATTERN = /\b(?:before|ahead of|prior to)\b/;
const MEDIUM_PATTERN = /\bmedium\b/;

const MAX_LEAD_MINUTES = 24 * 60;

const GTE_WORDS = new Set([
  "above",
  "over",
  "greater",
  "higher",
  "more",
  "least",
  "breaks",
  "break",
  "crosses",
  "cross",
  "hits",
  "hit",
  "reaches",
  "reach",
  "tops",
  "top",
  "exceeds",
  "exceed",
  "surpasses",
  "surpass",
  "climbs",
  "climb",
  "rises",
  "rise",
]);

const LTE_WORDS = new Set([
  "below",
  "under",
  "less",
  "lower",
  "most",
  "drops",
  "drop",
  "falls",
  "fall",
  "dips",
  "dip",
  "sinks",
  "sink",
  "goes",
  "go",
  "declines",
  "decline",
]);

const NOISE = new Set([
  "a",
  "add",
  "after",
  "ahead",
  "alert",
  "alerts",
  "america",
  "american",
  "an",
  "and",
  "are",
  "as",
  "at",
  "au",
  "australia",
  "australian",
  "be",
  "been",
  "before",
  "britain",
  "british",
  "but",
  "buy",
  "by",
  "ca",
  "cad",
  "calendar",
  "can",
  "canada",
  "canadian",
  "chf",
  "china",
  "chinese",
  "ch",
  "cn",
  "cny",
  "could",
  "cpi",
  "create",
  "data",
  "did",
  "do",
  "does",
  "dollar",
  "dollars",
  "ecb",
  "economic",
  "eur",
  "euro",
  "eurozone",
  "events",
  "ez",
  "fed",
  "fomc",
  "for",
  "from",
  "gdp",
  "gbp",
  "had",
  "has",
  "have",
  "high",
  "hour",
  "hours",
  "hr",
  "hrs",
  "if",
  "impact",
  "in",
  "into",
  "is",
  "ism",
  "it",
  "its",
  "japan",
  "japanese",
  "jpy",
  "jp",
  "just",
  "like",
  "long",
  "low",
  "macro",
  "make",
  "me",
  "medium",
  "message",
  "min",
  "mins",
  "minute",
  "minutes",
  "my",
  "need",
  "new",
  "nfp",
  "nonfarm",
  "not",
  "notify",
  "now",
  "nzd",
  "nz",
  "of",
  "on",
  "once",
  "or",
  "payroll",
  "payrolls",
  "pce",
  "ping",
  "please",
  "ppi",
  "price",
  "prices",
  "prior",
  "release",
  "releases",
  "remind",
  "reminder",
  "retail",
  "sales",
  "send",
  "sell",
  "set",
  "short",
  "should",
  "so",
  "soon",
  "swiss",
  "switzerland",
  "tell",
  "text",
  "than",
  "that",
  "the",
  "then",
  "this",
  "to",
  "today",
  "tomorrow",
  "track",
  "trades",
  "trade",
  "uk",
  "unemployment",
  "us",
  "usa",
  "usd",
  "value",
  "want",
  "was",
  "watch",
  "we",
  "were",
  "what",
  "when",
  "whenever",
  "will",
  "with",
  "would",
  "you",
]);

const CURRENCY_WORDS = new Set(["usd", "eur", "gbp", "jpy", "cad", "aud", "chf", "cny", "nzd"]);

const COUNTRY_CURRENCY = new Map<string, string>([
  ["us", "USD"],
  ["usa", "USD"],
  ["america", "USD"],
  ["eu", "EUR"],
  ["euro", "EUR"],
  ["eurozone", "EUR"],
  ["ez", "EUR"],
  ["uk", "GBP"],
  ["britain", "GBP"],
  ["jp", "JPY"],
  ["japan", "JPY"],
  ["ca", "CAD"],
  ["canada", "CAD"],
  ["au", "AUD"],
  ["australia", "AUD"],
  ["ch", "CHF"],
  ["switzerland", "CHF"],
  ["cn", "CNY"],
  ["china", "CNY"],
  ["nz", "NZD"],
  ["zealand", "NZD"],
]);

const EVENT_CURRENCY = new Map<string, string>([
  ["cpi", "USD"],
  ["fomc", "USD"],
  ["nfp", "USD"],
  ["nonfarm", "USD"],
  ["payrolls", "USD"],
  ["gdp", "USD"],
  ["ppi", "USD"],
  ["pce", "USD"],
  ["ism", "USD"],
  ["adp", "USD"],
  ["jobless", "USD"],
  ["unemployment", "USD"],
  ["retail", "USD"],
  ["fed", "USD"],
  ["ecb", "EUR"],
  ["boe", "GBP"],
  ["boj", "JPY"],
]);

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replaceAll(/(?<=\d),(?=\d{3}(?!\d))/g, "")
    .replaceAll(/([<>]=?)/g, " $1 ")
    .replaceAll(/[^a-z0-9.<>%\s]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function tokenize(normalized: string): string[] {
  return normalized
    .split(" ")
    .map((token) => token.replaceAll(/^\.+|\.+$/g, ""))
    .filter((token) => token.length > 0);
}

function parseAmount(token: string): number | null {
  const match = AMOUNT_PATTERN.exec(token);
  if (match === null) return null;
  const base = Number(match[1]);
  const suffix = match[2];
  const scale =
    suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : suffix === "b" ? 1_000_000_000 : 1;
  const value = base * scale;
  return Number.isFinite(value) ? value : null;
}

function findOp(tokens: string[]): "gte" | "lte" | null {
  let op: "gte" | "lte" | null = null;
  for (const token of tokens) {
    const hit =
      token === ">" || token === ">=" || GTE_WORDS.has(token)
        ? "gte"
        : token === "<" || token === "<=" || LTE_WORDS.has(token)
          ? "lte"
          : null;
    if (hit === null) continue;
    if (op !== null && op !== hit) return null;
    op = hit;
  }
  return op;
}

function findSymbol(tokens: string[]): string | null {
  const candidates = new Set<string>();
  for (const token of tokens) {
    if (!SYMBOL_PATTERN.test(token)) continue;
    if (NOISE.has(token) || GTE_WORDS.has(token) || LTE_WORDS.has(token)) continue;
    if (parseAmount(token) !== null) continue;
    candidates.add(token.toUpperCase());
  }
  if (candidates.size !== 1) return null;
  const [symbol] = candidates;
  return symbol ?? null;
}

function findCurrency(tokens: string[]): string | null {
  const explicit = new Set<string>();
  for (const token of tokens) {
    if (CURRENCY_WORDS.has(token)) explicit.add(token.toUpperCase());
    const mapped = COUNTRY_CURRENCY.get(token);
    if (mapped !== undefined) explicit.add(mapped);
  }
  if (explicit.size > 1) return null;
  if (explicit.size === 1) {
    const [currency] = explicit;
    return currency ?? null;
  }

  const implied = new Set<string>();
  for (const token of tokens) {
    const mapped = EVENT_CURRENCY.get(token);
    if (mapped !== undefined) implied.add(mapped);
  }
  if (implied.size > 1) return null;
  const [currency] = implied;
  return currency ?? null;
}

function parsePrice(tokens: string[]): ParsedDraft {
  const op = findOp(tokens);
  if (op === null) return null;

  const values = tokens
    .map((token) => parseAmount(token))
    .filter((value): value is number => value !== null);
  if (values.length !== 1) return null;
  const value = values[0];

  const symbol = findSymbol(tokens);
  if (symbol === null) return null;

  return { kind: "price", symbol, op, value };
}

function parseCalendar(normalized: string, tokens: string[]): ParsedDraft {
  if (!BEFORE_PATTERN.test(normalized)) return null;

  const matches = [...normalized.matchAll(LEAD_PATTERN)];
  if (matches.length !== 1) return null;
  const match = matches[0];
  if (match === undefined) return null;

  const raw = Number(match[1]);
  const unit = match[2] ?? "";
  const leadMinutes = Math.round(raw * (unit.startsWith("h") ? 60 : 1));
  if (!Number.isFinite(leadMinutes) || leadMinutes <= 0 || leadMinutes > MAX_LEAD_MINUTES) {
    return null;
  }

  const currency = findCurrency(tokens);
  if (currency === null) return null;

  const impactMin: "medium" | "high" = MEDIUM_PATTERN.test(normalized) ? "medium" : "high";
  return { kind: "calendar", currency, leadMinutes, impactMin };
}

/**
 * Turn one typed sentence into a draft. Anything the parser cannot pin down to a
 * single reading returns null, so the caller can ask instead of guessing.
 */
export function parseRule(input: string): ParsedDraft {
  const normalized = normalize(input);
  if (normalized.length === 0) return null;
  const tokens = tokenize(normalized);

  const calendar = parseCalendar(normalized, tokens);
  if (calendar === null) return parsePrice(tokens);

  const price = parsePrice(tokenize(normalized.replaceAll(LEAD_PATTERN, " ")));
  return price === null ? calendar : null;
}
