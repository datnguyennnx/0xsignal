/**
 * @overview Depth Chart Visible Range Utilities
 *
 * Provides constants and helper functions to manage the "half-span" (zoom level) of the depth chart.
 * Ensures the visible price range stays within valid boundaries.
 */
const MIN_HALF_SPAN = 0.00000001;

export function getMinHalfSpanValue(): number {
  return MIN_HALF_SPAN;
}

export function clampHalfSpan(
  value: number | null,
  minHalfSpan: number | null,
  maxHalfSpan: number | null
): number | null {
  if (value === null || minHalfSpan === null || maxHalfSpan === null) {
    return null;
  }

  return Math.min(Math.max(value, minHalfSpan), maxHalfSpan);
}
