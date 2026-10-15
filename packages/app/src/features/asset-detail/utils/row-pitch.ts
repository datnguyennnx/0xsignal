import { GRID_ROW_HEIGHT, GRID_GUTTER, GRID_ROW_PITCH_CSS } from "./constants";

const REM_PX = 16;

/** Parse a plain CSS length ("40px" / "2.5rem") to pixels; 0 for anything else. */
export function parseLengthPx(value: string): number {
  const trimmed = value.trim();
  const n = parseFloat(trimmed);
  if (!Number.isFinite(n)) return 0;
  if (trimmed.endsWith("rem")) return n * REM_PX;
  if (trimmed.endsWith("px")) return n;
  return 0;
}

/**
 * Resolve the DISPLAYED vertical row pitch (row height + 0.5rem gap) in pixels.
 * The declared token can be a clamp()/calc() expression the CSSOM will not
 * reduce for us, so measure the resolved pitch in-context before giving up.
 */
export function readRowPitchPx(containerEl: HTMLElement): number {
  const declared = parseLengthPx(
    getComputedStyle(containerEl).getPropertyValue("--grid-row-height"),
  );
  if (declared > 0) return declared + GRID_GUTTER;

  const probe = document.createElement("div");
  probe.style.cssText = `position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;height:${GRID_ROW_PITCH_CSS}`;
  containerEl.appendChild(probe);
  const measured = probe.getBoundingClientRect().height;
  containerEl.removeChild(probe);
  if (measured > 0) return measured;

  return GRID_ROW_HEIGHT + GRID_GUTTER;
}
