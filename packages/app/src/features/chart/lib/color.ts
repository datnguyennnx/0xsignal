// lightweight-charts only parses hex and rgb()/rgba(); CSS tokens resolve to oklch().

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB_RE = /^rgba?\([^()]*\)$/i;
const OKLCH_RE = /^oklch\(([^)]*)\)$/i;

interface Channels {
  r: number;
  g: number;
  b: number;
  a: number;
}

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

const parseNumber = (raw: string, percentScale = 1): number => {
  const percent = raw.endsWith("%");
  const parsed = percent ? Number(raw.slice(0, -1)) : Number(raw);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return percent ? (parsed / 100) * percentScale : parsed;
};

const toByte = (linear: number): number => {
  const gamma = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  return Math.round(clamp(gamma, 0, 1) * 255);
};

const parseHex = (value: string): Channels | null => {
  const digits = value.slice(1);
  const short = digits.length === 3 || digits.length === 4;
  const step = short ? 1 : 2;
  const parts: number[] = [];
  for (let i = 0; i < digits.length; i += step) {
    parts.push(Number.parseInt(short ? digits[i].repeat(2) : digits.slice(i, i + 2), 16));
  }
  const [r, g, b, a] = parts;
  if ([r, g, b].some((channel) => !Number.isFinite(channel))) return null;
  return { r, g, b, a: a === undefined ? 1 : a / 255 };
};

const parseRgb = (body: string): Channels | null => {
  const parts = body
    .trim()
    .split(/[\s,/]+/)
    .filter(Boolean);
  if (parts.length < 3) return null;
  const r = clamp(parseNumber(parts[0], 255), 0, 255);
  const g = clamp(parseNumber(parts[1], 255), 0, 255);
  const b = clamp(parseNumber(parts[2], 255), 0, 255);
  const a = parts[3] === undefined ? 1 : clamp(parseNumber(parts[3]), 0, 1);
  if ([r, g, b, a].some((channel) => !Number.isFinite(channel))) return null;
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a };
};

const parseOklch = (body: string): Channels | null => {
  const [head, alphaRaw] = body.split("/");
  const parts = head
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length < 3) return null;
  const l = parseNumber(parts[0]);
  const c = parseNumber(parts[1], 0.4);
  const h = parseNumber(parts[2], 360);
  const a = alphaRaw === undefined ? 1 : clamp(parseNumber(alphaRaw.trim()), 0, 1);
  if ([l, c, h, a].some((value) => !Number.isFinite(value))) return null;

  // oklch -> oklab -> linear sRGB (Björn Ottosson), then sRGB gamma encode.
  const hue = (h * Math.PI) / 180;
  const aAxis = c * Math.cos(hue);
  const bAxis = c * Math.sin(hue);
  const lCube = (l + 0.3963377774 * aAxis + 0.2158037573 * bAxis) ** 3;
  const mCube = (l - 0.1055613458 * aAxis - 0.0638541728 * bAxis) ** 3;
  const sCube = (l - 0.0894841775 * aAxis - 1.291485548 * bAxis) ** 3;

  return {
    r: toByte(4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube),
    g: toByte(-1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube),
    b: toByte(-0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube),
    a,
  };
};

const roundAlpha = (alpha: number): number => Math.round(clamp(alpha, 0, 1) * 1000) / 1000;

const toHex = ({ r, g, b }: Channels): string =>
  `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;

const parseChannels = (value: string): Channels | null => {
  if (HEX_RE.test(value)) return parseHex(value);
  if (RGB_RE.test(value)) return parseRgb(value.slice(value.indexOf("(") + 1, -1));
  const oklch = OKLCH_RE.exec(value);
  if (oklch) return parseOklch(oklch[1]);
  return null;
};

const FALLBACK_TOKEN = "--ink";
/** --ink flips with the theme, so a failed read stays legible on both; grey is the last-resort triple. */
const FALLBACK_CHANNELS: Channels = { r: 99, g: 99, b: 99, a: 1 };

const toColorString = (channels: Channels): string =>
  channels.a >= 1
    ? toHex(channels)
    : `rgba(${channels.r}, ${channels.g}, ${channels.b}, ${roundAlpha(channels.a)})`;

const fallbackChannels = (): Channels => {
  if (typeof document === "undefined") return FALLBACK_CHANNELS;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(FALLBACK_TOKEN);
  return parseChannels(raw.trim()) ?? FALLBACK_CHANNELS;
};

export const toRgb = (input: string): string => {
  const value = input.trim();
  if (HEX_RE.test(value) || RGB_RE.test(value)) return value;
  const channels = parseChannels(value);
  return toColorString(channels ?? fallbackChannels());
};

export const toRgba = (input: string, alpha: number): string => {
  const channels = parseChannels(input.trim()) ?? fallbackChannels();
  return `rgba(${channels.r}, ${channels.g}, ${channels.b}, ${roundAlpha(alpha)})`;
};

const SERIES_TOKENS = [
  "--data-1",
  "--data-2",
  "--data-3",
  "--data-4",
  "--data-5",
  "--data-6",
  "--data-7",
  "--data-8",
] as const;

/** Series identity, never gain/loss: the hash only picks a slot of the categorical ramp. */
export const getSeriesColor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = Math.imul(hash, 31) + (seed.codePointAt(i) ?? 0);
  }
  if (typeof document === "undefined") return toRgb("");
  const token = SERIES_TOKENS[Math.abs(hash) % SERIES_TOKENS.length];
  return toRgb(getComputedStyle(document.documentElement).getPropertyValue(token));
};
