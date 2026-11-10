import { getRootFontSizePx, remToPxAt } from "@/core/utils/rem";

type TriggerRect = {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
};

type Viewport = {
  readonly width: number;
  readonly height: number;
};

/**
 * Panel chrome above the list at the default density (spacing unit 0.35rem,
 * control height 2.5rem):
 *  - search block: `p-3` (2 × 3 × 0.35rem) + `h-control` (2.5rem) = 4.6rem
 *  - tab strip: `p-(--seg-inset)` (2 × 0.1875rem), `py-2` buttons (2 × 2 × 0.35rem)
 *    and the `type-data` line (0.8125rem × 1.35) = 2.871875rem
 *  - column header: `py-1` (2 × 0.35rem) + the `type-label` line
 *    (0.75rem × 1.2) = 1.6rem
 */
export const PANEL_CHROME_REM = 4.6 + 2.871875 + 1.6;
/** The list paints this many rows before it scrolls; owned by the panel. */
export const PANEL_LIST_ROW_COUNT = 10;
/** A row is `type-body` (0.875rem × 1.5) plus `py-1` (2 × 0.35rem). */
export const PANEL_ROW_HEIGHT_REM = 1.3125 + 0.7;
/** Default-density content height: chrome plus a full screen of rows. */
export const PANEL_CONTENT_HEIGHT_REM =
  PANEL_CHROME_REM + PANEL_ROW_HEIGHT_REM * PANEL_LIST_ROW_COUNT;
/** The root's own bound: `max-h-[calc(100dvh-2rem)]`. */
const PANEL_VIEWPORT_INSET_REM = 2;
/** Gap between the trigger and the panel, and the minimum viewport edge. */
const GAP_REM = 0.5;
const VIEWPORT_EDGE_REM = 1.25;
/** Horizontal budget the flip uses: the panel's `sm` width ceiling. */
const PANEL_WIDTH_REM = 43.75;
/** The right-aligned fallback adds the viewport edge margin. */
const EDGE_MARGIN_REM = 0.625;

/**
 * The panel's initial row height in px before its ResizeObserver measures a real
 * row; derived from the shared rem composition so there is one source of truth.
 */
export function defaultRowHeightPx(rootFontSizePx: number = getRootFontSizePx()): number {
  return remToPxAt(PANEL_ROW_HEIGHT_REM, rootFontSizePx);
}

/**
 * The tallest the panel can paint: chrome plus the rows, clipped by the root's
 * `100dvh - 2rem` cap. The row height defaults to its rem composition so callers
 * that only know the root size still get the panel's real height; a caller that
 * has measured a row passes it in and overrides the default.
 */
export function panelHeightBudget(
  viewportHeightPx: number,
  rootFontSizePx: number = getRootFontSizePx(),
  rowHeightPx: number = remToPxAt(PANEL_ROW_HEIGHT_REM, rootFontSizePx),
  rowCount: number = PANEL_LIST_ROW_COUNT,
): number {
  const content = remToPxAt(PANEL_CHROME_REM, rootFontSizePx) + rowHeightPx * rowCount;
  const viewportCap = Math.max(
    0,
    viewportHeightPx - remToPxAt(PANEL_VIEWPORT_INSET_REM, rootFontSizePx),
  );
  return Math.min(content, viewportCap);
}

export function computeOverlayPosition(
  triggerRect: TriggerRect,
  viewport: Viewport,
  rootFontSizePx: number = getRootFontSizePx(),
): { left: number; top: number } {
  const rem = (value: number) => remToPxAt(value, rootFontSizePx);
  let left = rem(0.5);
  let top = triggerRect.bottom + rem(GAP_REM);

  if (viewport.width >= 640) {
    left = Math.max(rem(0.5), triggerRect.left);
    if (left + rem(PANEL_WIDTH_REM) > viewport.width) {
      left = Math.max(rem(0.5), viewport.width - rem(PANEL_WIDTH_REM + EDGE_MARGIN_REM));
    }
  }

  const panelHeight = panelHeightBudget(viewport.height, rootFontSizePx);
  if (top + panelHeight > viewport.height - rem(VIEWPORT_EDGE_REM)) {
    top = triggerRect.top - panelHeight - rem(GAP_REM);
  }
  if (top < rem(VIEWPORT_EDGE_REM)) {
    top = rem(VIEWPORT_EDGE_REM);
  }

  // The capped panel can still be taller than the space under the trigger on a
  // short viewport; keep the painted box inside the viewport rather than trusting the flip.
  const maxTop = Math.max(
    rem(VIEWPORT_EDGE_REM),
    viewport.height - panelHeight - rem(VIEWPORT_EDGE_REM),
  );
  if (top > maxTop) top = maxTop;

  return { left, top };
}
