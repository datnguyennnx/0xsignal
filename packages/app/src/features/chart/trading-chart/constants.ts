/**
 * @overview Trading Chart Constants
 *
 * Defines the available timeframes (intervals) and layout constants for the chart.
 */
export const DEFAULT_INTERVALS = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
] as const;

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

export const INTERVALS = ALL_INTERVALS;

export const MOBILE_BREAKPOINT = 768;
export const VOLUME_PANE_HEIGHT = 100;
export const INDICATOR_PANE_HEIGHT = 120;
export const RESIZE_DELAY = 50;
export const INTERVAL_RESTORE_DELAY = 100;
