/**
 * @overview Wyckoff Method Color Palette
 */
export interface WyckoffColors {
  tradingRange: { fill: string; border: string };
  climax: { sc: string; bc: string };
  event: {
    spring: string;
    upthrust: string;
    lps: string;
    lpsy: string;
    sos: string;
    sow: string;
    st: string;
  };
  effort: { bullish: string; bearish: string; neutral: string; result: string };
  phase: { fill: string; border: string };
}

import { getThemeColor } from "@/core/utils/theme";

export const getWyckoffColors = (_isDark: boolean): WyckoffColors => {
  return {
    tradingRange: {
      fill: getThemeColor("wyckoff-tr-fill", "rgba(99, 102, 241, 0.06)"),
      border: getThemeColor("wyckoff-tr-border", "rgba(99, 102, 241, 0.40)"),
    },
    climax: {
      sc: getThemeColor("wyckoff-climax-sc", "rgba(244, 63, 94, 0.70)"),
      bc: getThemeColor("wyckoff-climax-bc", "rgba(16, 185, 129, 0.70)"),
    },
    event: {
      spring: getThemeColor("wyckoff-event-spring", "rgba(16, 185, 129, 0.75)"),
      upthrust: getThemeColor("wyckoff-event-upthrust", "rgba(244, 63, 94, 0.75)"),
      lps: getThemeColor("wyckoff-event-lps", "rgba(16, 185, 129, 0.65)"),
      lpsy: getThemeColor("wyckoff-event-lpsy", "rgba(244, 63, 94, 0.65)"),
      sos: getThemeColor("wyckoff-event-sos", "rgba(34, 197, 94, 0.80)"),
      sow: getThemeColor("wyckoff-event-sow", "rgba(239, 68, 68, 0.80)"),
      st: getThemeColor("wyckoff-event-st", "rgba(161, 161, 170, 0.55)"),
    },
    effort: {
      bullish: getThemeColor("effort-bullish", "rgba(16, 185, 129, 0.50)"),
      bearish: getThemeColor("effort-bearish", "rgba(244, 63, 94, 0.50)"),
      neutral: getThemeColor("effort-neutral", "rgba(107, 114, 128, 0.40)"),
      result: getThemeColor("effort-result", "rgba(148, 163, 184, 0.35)"),
    },
    phase: {
      fill: getThemeColor("phase-fill-a", "rgba(99, 102, 241, 0.04)"),
      border: getThemeColor("phase-border-a", "rgba(99, 102, 241, 0.25)"),
    },
  };
};
