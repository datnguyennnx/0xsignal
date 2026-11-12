import { remToPx, subscribeRootFontSize } from "@/core/utils/rem";
import { getGridGutter, getGridRowHeight } from "./constants";

/** Parse a plain CSS length ("40px" / "2.5rem") to pixels; 0 for anything else. */
function parseLengthPx(value: string): number {
  const trimmed = value.trim();
  const isRem = trimmed.endsWith("rem");
  const isPx = trimmed.endsWith("px");
  if (!isRem && !isPx) return 0;
  const n = Number(isRem ? trimmed.slice(0, -3) : trimmed.slice(0, -2));
  if (!Number.isFinite(n)) return 0;
  return isRem ? remToPx(n) : n;
}

/**
 * The fit pitch is a viewport-derived calc(), so it can only change when the
 * viewport (and with it the root font-size) does. One epoch bump per root
 * font-size change invalidates every cached measurement without observing
 * (and retaining) the measured elements.
 */
let pitchEpoch = 0;

subscribeRootFontSize(() => {
  pitchEpoch += 1;
});

const pitchByContainer = new WeakMap<HTMLElement, { epoch: number; value: number }>();

/**
 * Resolve the DISPLAYED vertical row pitch (row height + 0.5rem gap) in pixels
 * for a gesture. When the declared token is a plain length this is exact; when
 * it is a clamp()/calc() the constant the stylesheet was built from is used,
 * so a gesture never needs a probe element to read the pitch back.
 */
export function readRowPitchPx(containerEl: HTMLElement): number {
  const cached = pitchByContainer.get(containerEl);
  if (cached !== undefined && cached.epoch === pitchEpoch) return cached.value;

  const value = measureRowPitchPx(containerEl);
  pitchByContainer.set(containerEl, { epoch: pitchEpoch, value });
  return value;
}

function measureRowPitchPx(containerEl: HTMLElement): number {
  const declared = parseLengthPx(
    getComputedStyle(containerEl).getPropertyValue("--grid-row-height"),
  );
  return (declared > 0 ? declared : getGridRowHeight()) + getGridGutter();
}
