export const isDarkMode = (): boolean => document.documentElement.classList.contains("dark");

export const colors = {
  gain: {
    DEFAULT: "var(--gain)",
    light: "var(--gain-light)",
    dark: "var(--gain-dark)",
    muted: "var(--gain-muted)",
  },
  loss: {
    DEFAULT: "var(--loss)",
    light: "var(--loss-light)",
    dark: "var(--loss-dark)",
    muted: "var(--loss-muted)",
  },
  warn: {
    DEFAULT: "var(--warn)",
    light: "var(--warn-light)",
    dark: "var(--warn-dark)",
    muted: "var(--warn-muted)",
  },
} as const;

export const getChartColors = (isDark: boolean) => ({
  bg: "transparent",
  grid: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
  text: isDark ? "#a1a1aa" : "#78716c",
  border: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)",
  crosshair: isDark ? "#71717a" : "#a8a29e",
  tooltipBg: isDark ? "rgba(24, 24, 27, 0.96)" : "rgba(255, 255, 255, 0.96)",
  tooltipBorder: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)",
  tooltipText: isDark ? "#fafafa" : "#1c1917",
  gain: isDark ? "#22c55e" : "#16a34a",
  gainLight: isDark ? "#4ade80" : "#22c55e",
  gainDark: isDark ? "#16a34a" : "#15803d",
  loss: isDark ? "#ef4444" : "#dc2626",
  lossLight: isDark ? "#f87171" : "#ef4444",
  lossDark: isDark ? "#dc2626" : "#b91c1c",
  warn: isDark ? "#f59e0b" : "#d97706",
  volume: isDark ? "#52525b" : "#a8a29e",
  heatmap: {
    gainStrong: isDark ? "#16a34a" : "#15803d",
    gain: isDark ? "#22c55e" : "#16a34a",
    gainLight: isDark ? "#4ade80" : "#22c55e",
    lossStrong: isDark ? "#dc2626" : "#b91c1c",
    loss: isDark ? "#ef4444" : "#dc2626",
    lossLight: isDark ? "#f87171" : "#ef4444",
    neutral: isDark ? "#52525b" : "#a8a29e",
    marker: isDark ? "#f59e0b" : "#d97706",
  },
});

export const getCandlestickColors = (isDark: boolean) => ({
  upColor: isDark ? "#22c55e" : "#16a34a",
  downColor: isDark ? "#ef4444" : "#dc2626",
  wickUpColor: isDark ? "#22c55e" : "#16a34a",
  wickDownColor: isDark ? "#ef4444" : "#dc2626",
});

export const getVolumeColor = (isUp: boolean, isDark: boolean): string => {
  if (isUp) return isDark ? "#22c55e" : "#16a34a";
  return isDark ? "#ef4444" : "#dc2626";
};
