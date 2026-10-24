import { remToPx, subscribeRootFontSize } from "@/core/utils/rem";
import { getGridGutter, getGridRowHeight, GRID_ROW_PITCH_CSS } from "./constants";

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
 * Resolve the DISPLAYED vertical row pitch (row height + 0.5rem gap) in pixels.
 * The declared token can be a clamp()/calc() expression the CSSOM will not
 * reduce for us, so measure the resolved pitch in-context before giving up.
 * The probe is a per-container one-off: gestures read the cache, never the DOM.
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
  if (declared > 0) return declared + getGridGutter();

  const probe = document.createElement("div");
  probe.style.cssText = `position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;height:${GRID_ROW_PITCH_CSS}`;
  containerEl.append(probe);
  const measured = probe.getBoundingClientRect().height;
  probe.remove();
  if (measured > 0) return measured;

  return getGridRowHeight() + getGridGutter();
}
