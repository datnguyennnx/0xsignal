const FIRST_QUIP = "Prepare the paperwork for a new server crew.";

const ERROR_QUIPS: readonly string[] = [
  FIRST_QUIP,
  "The order book stepped out. Said it would be quick.",
  "Liquidity is on lunch. Please hold.",
  "Somebody bumped the feed. Nobody is owning up.",
  "Your candles are being remade. Fresh batch, no charge.",
  "This is a fine moment to touch grass. The market will wait.",
  "Please welcome the new server. It starts Monday.",
  "Nothing is broken. It is merely resting.",
];

export function pickErrorQuip(random: () => number = Math.random): string {
  const raw = random();
  const normalized = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), 1) : 0;
  const index = Math.min(Math.floor(normalized * ERROR_QUIPS.length), ERROR_QUIPS.length - 1);
  return ERROR_QUIPS[index] ?? FIRST_QUIP;
}
