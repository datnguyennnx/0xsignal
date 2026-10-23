import type { UTCTimestamp } from "lightweight-charts";

// lightweight-charts brands UTC timestamps; epoch seconds must be validated before use.
export const isUtcTimestamp = (time: number): time is UTCTimestamp => Number.isFinite(time);

export type UtcDated<T> = Omit<T, "time"> & { time: UTCTimestamp };

// Drops points the chart cannot place, and brands the epoch seconds it accepts.
export const toUtcTimestamps = <T extends { readonly time: number }>(
  points: readonly T[],
): UtcDated<T>[] =>
  points.flatMap((point) => (isUtcTimestamp(point.time) ? [{ ...point, time: point.time }] : []));
