import type { Time } from "lightweight-charts";

/**
 * Ensures an array of points with `time` and `value` properties has unique, ascending times.
 * If duplicate times exist, the last value wins.
 */
export function ensureUniqueAscending(
  points: { time: number; value: number }[]
): { time: Time; value: number }[] {
  if (points.length === 0) return [];
  const uniqueMap = new Map<number, number>();
  for (const p of points) {
    uniqueMap.set(p.time, p.value);
  }
  return Array.from(uniqueMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({ time: time as Time, value }));
}
