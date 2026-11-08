/** Pure colour math shared by contrast checks: no DOM, no canvas. */

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface WorstBackdrop {
  painted: Rgba;
  backdrop: Rgba;
  ratio: number;
}

const OKLCH_RE = /^oklch\(([^)]*)\)$/i;
const RGB_RE = /^rgba?\(([^)]*)\)$/i;
const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

const parseNumber = (raw: string, percentScale = 1): number => {
  const text = raw.trim();
  const percent = text.endsWith("%");
  const parsed = Number(percent ? text.slice(0, -1) : text);
  if (!Number.isFinite(parsed)) return Number.NaN;
  return percent ? (parsed / 100) * percentScale : parsed;
};

/** Linear-light channel -> stored sRGB byte. */
const toByte = (linear: number): number => {
  const gamma = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  return Math.round(clamp(gamma, 0, 1) * 255);
};

const parseHex = (value: string): Rgba | null => {
  const digits = value.slice(1);
  const short = digits.length === 3 || digits.length === 4;
  const step = short ? 1 : 2;
  const parts: number[] = [];
  for (let i = 0; i < digits.length; i += step) {
    const chunk = short ? digits[i].repeat(2) : digits.slice(i, i + 2);
    parts.push(Number.parseInt(chunk, 16));
  }
  const [r, g, b, a] = parts;
  if ([r, g, b].some((channel) => !Number.isFinite(channel))) return null;
  return { r, g, b, a: a === undefined ? 1 : a / 255 };
};

const parseRgb = (body: string): Rgba | null => {
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

const parseOklch = (body: string): Rgba | null => {
  const [head, alphaRaw] = body.split("/");
  const parts = head
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length < 3) return null;
  const lightness = parseNumber(parts[0]);
  const chroma = parseNumber(parts[1], 0.4);
  const hue = parseNumber(parts[2], 360);
  const alpha = alphaRaw === undefined ? 1 : clamp(parseNumber(alphaRaw), 0, 1);
  if ([lightness, chroma, hue, alpha].some((value) => !Number.isFinite(value))) return null;

  // Björn Ottosson's oklch -> oklab -> linear sRGB, then gamma encode.
  const radians = (hue * Math.PI) / 180;
  const aAxis = chroma * Math.cos(radians);
  const bAxis = chroma * Math.sin(radians);
  const l = (lightness + 0.3963377774 * aAxis + 0.2158037573 * bAxis) ** 3;
  const m = (lightness - 0.1055613458 * aAxis - 0.0638541728 * bAxis) ** 3;
  const s = (lightness - 0.0894841775 * aAxis - 1.291485548 * bAxis) ** 3;

  return {
    r: toByte(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: toByte(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: toByte(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: alpha,
  };
};

export function parseCssColor(css: string): Rgba | null {
  const value = css.trim();
  if (HEX_RE.test(value)) return parseHex(value);
  const rgb = RGB_RE.exec(value);
  if (rgb !== null) return parseRgb(rgb[1]);
  const oklch = OKLCH_RE.exec(value);
  if (oklch !== null) return parseOklch(oklch[1]);
  return null;
}

/** Straight-alpha blend in gamma (stored sRGB) space; `bottom` is assumed opaque. */
export function alphaComposite(top: Rgba, bottom: Rgba): Rgba {
  return {
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  };
}

const srgbChannel = (value: number): number => {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

function relativeLuminance(color: Rgba): number {
  return (
    0.2126 * srgbChannel(color.r) + 0.7152 * srgbChannel(color.g) + 0.0722 * srgbChannel(color.b)
  );
}

/** WCAG 2.x contrast ratio; a translucent foreground is flattened onto the background first. */
export function contrastRatio(foreground: Rgba, background: Rgba): number {
  const text = foreground.a < 1 ? alphaComposite(foreground, background) : foreground;
  const first = relativeLuminance(text);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/** The composite that yields the lowest ratio across every backdrop, or `null` when empty. */
export function worstBackdrop(foreground: Rgba, backdrops: readonly Rgba[]): WorstBackdrop | null {
  let worst: WorstBackdrop | null = null;
  for (const backdrop of backdrops) {
    const painted = foreground.a < 1 ? alphaComposite(foreground, backdrop) : foreground;
    const ratio = contrastRatio(painted, backdrop);
    if (worst === null || ratio < worst.ratio) worst = { painted, backdrop, ratio };
  }
  return worst;
}

export function worstContrast(foreground: Rgba, backdrops: readonly Rgba[]): number {
  return worstBackdrop(foreground, backdrops)?.ratio ?? Number.POSITIVE_INFINITY;
}
