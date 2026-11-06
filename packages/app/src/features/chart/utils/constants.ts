import { remToPx } from "@/core/utils/rem";

export const ALL_INTERVALS = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "1h", label: "1h" },
  { value: "2h", label: "2h" },
  { value: "4h", label: "4h" },
  { value: "8h", label: "8h" },
  { value: "12h", label: "12h" },
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
] as const;

/** The pinned header intervals; the rest fall into the overflow menu. Derived from ALL_INTERVALS so the two cannot drift. */
const DEFAULT_INTERVAL_VALUES: ReadonlySet<string> = new Set(["1m", "5m", "15m", "1h"]);

export const DEFAULT_INTERVALS = ALL_INTERVALS.filter((interval) =>
  DEFAULT_INTERVAL_VALUES.has(interval.value),
);

export const getVolumePaneHeight = (): number => remToPx(6.25);

export const INTERVAL_RESTORE_DELAY = 100;
