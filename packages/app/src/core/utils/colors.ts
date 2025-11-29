// Centralized color system for charts and visualizations
// All colors reference CSS variables for theme consistency

// Get computed CSS variable value
const getCSSVar = (name: string): string => {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

// Theme detection
export const isDarkMode = (): boolean => document.documentElement.classList.contains("dark");

// ===== SEMANTIC COLORS =====
export const colors = {
  // Gain (Green) - High contrast for visibility
  gain: {
    DEFAULT: "var(--gain)",
    light: "var(--gain-light)",
    dark: "var(--gain-dark)",
    muted: "var(--gain-muted)",
  },
  // Loss (Red) - High contrast for visibility
  loss: {
    DEFAULT: "var(--loss)",
    light: "var(--loss-light)",
    dark: "var(--loss-dark)",
    muted: "var(--loss-muted)",
  },
  // Warn (Amber) - High contrast for visibility
  warn: {
    DEFAULT: "var(--warn)",
    light: "var(--warn-light)",
    dark: "var(--warn-dark)",
    muted: "var(--warn-muted)",
  },
} as const;

// ===== CHART COLORS (for external libraries) =====
export const getChartColors = (isDark: boolean) => ({
  // Background & Grid
  bg: isDark ? "#18181b" : "#fafaf9",
  grid: isDark ? "#27272a" : "#e7e5e4",
  text: isDark ? "#a1a1aa" : "#78716c",
  border: isDark ? "#3f3f46" : "#d6d3d1",
  crosshair: isDark ? "#71717a" : "#a8a29e",

  // Tooltip
  tooltipBg: isDark ? "rgba(24, 24, 27, 0.96)" : "rgba(255, 255, 255, 0.96)",
  tooltipBorder: isDark ? "#3f3f46" : "#e7e5e4",
  tooltipText: isDark ? "#fafafa" : "#1c1917",

  // Semantic - Gain/Loss
  gain: isDark ? "#22c55e" : "#16a34a",
  gainLight: isDark ? "#4ade80" : "#22c55e",
  gainDark: isDark ? "#16a34a" : "#15803d",
  loss: isDark ? "#ef4444" : "#dc2626",
  lossLight: isDark ? "#f87171" : "#ef4444",
  lossDark: isDark ? "#dc2626" : "#b91c1c",
  warn: isDark ? "#f59e0b" : "#d97706",

  // Volume - Neutral gray
  volume: isDark ? "#52525b" : "#a8a29e",

  // Heatmap specific
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

// ===== CANDLESTICK COLORS =====
export const getCandlestickColors = (isDark: boolean) => ({
  upColor: isDark ? "#22c55e" : "#16a34a",
  downColor: isDark ? "#ef4444" : "#dc2626",
  wickUpColor: isDark ? "#22c55e" : "#16a34a",
  wickDownColor: isDark ? "#ef4444" : "#dc2626",
});

// ===== VOLUME COLORS =====
export const getVolumeColor = (isUp: boolean, isDark: boolean): string => {
  if (isUp) return isDark ? "#22c55e" : "#16a34a";
  return isDark ? "#ef4444" : "#dc2626";
};

// ===== HEATMAP COLOR SCALE =====
// Higher contrast colors for better visibility
export const getHeatmapColor = (change: number, isDark: boolean): string => {
  // Stronger, more saturated colors for better contrast
  if (isDark) {
    // Dark mode - brighter colors
    if (change >= 10) return "#059669"; // Very strong gain (emerald-600)
    if (change >= 5) return "#10b981"; // Strong gain (emerald-500)
    if (change >= 2) return "#22c55e"; // Gain (green-500)
    if (change >= 0.5) return "#4ade80"; // Light gain (green-400)
    if (change >= 0) return "#6ee7b7"; // Very light gain
    if (change >= -0.5) return "#fca5a5"; // Very light loss
    if (change >= -2) return "#f87171"; // Light loss (red-400)
    if (change >= -5) return "#ef4444"; // Loss (red-500)
    if (change >= -10) return "#dc2626"; // Strong loss (red-600)
    return "#b91c1c"; // Very strong loss (red-700)
  } else {
    // Light mode - darker, more saturated colors
    if (change >= 10) return "#047857"; // Very strong gain (emerald-700)
    if (change >= 5) return "#059669"; // Strong gain (emerald-600)
    if (change >= 2) return "#10b981"; // Gain (emerald-500)
    if (change >= 0.5) return "#34d399"; // Light gain (emerald-400)
    if (change >= 0) return "#6ee7b7"; // Very light gain (emerald-300)
    if (change >= -0.5) return "#fca5a5"; // Very light loss (red-300)
    if (change >= -2) return "#f87171"; // Light loss (red-400)
    if (change >= -5) return "#ef4444"; // Loss (red-500)
    if (change >= -10) return "#dc2626"; // Strong loss (red-600)
    return "#b91c1c"; // Very strong loss (red-700)
  }
};

// ===== INDICATOR COLORS (grayscale for monochrome) =====
export const getIndicatorColors = (isDark: boolean) => [
  isDark ? "#a1a1aa" : "#78716c", // Gray
  isDark ? "#71717a" : "#a8a29e", // Gray lighter
  isDark ? "#52525b" : "#d6d3d1", // Gray darker
  isDark ? "#3f3f46" : "#e7e5e4", // Gray muted
];
