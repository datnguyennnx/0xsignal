import type { Time } from "lightweight-charts";

export const ensureUniqueAscending = <T extends { time: number }>(
  points: T[],
  valueKey?: keyof T
): { time: Time; value: number }[] => {
  if (points.length === 0) return [];

  const sorted = [...points].sort((a, b) => a.time - b.time);
  const uniqueMap = new Map<number, number>();

  for (const p of sorted) {
    const value = valueKey ? (p[valueKey] as number) : (p as unknown as { price: number }).price;
    uniqueMap.set(p.time, value);
  }

  return Array.from(uniqueMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({ time: time as Time, value }));
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const debounce = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

export const throttle = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};
