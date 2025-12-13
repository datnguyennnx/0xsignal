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
  effort: { bullish: string; bearish: string };
  phase: { fill: string; border: string };
}

export const getWyckoffColors = (isDark: boolean): WyckoffColors => {
  if (isDark) {
    return {
      tradingRange: {
        fill: "rgba(99, 102, 241, 0.06)",
        border: "rgba(99, 102, 241, 0.40)",
      },
      climax: {
        sc: "rgba(244, 63, 94, 0.70)",
        bc: "rgba(16, 185, 129, 0.70)",
      },
      event: {
        spring: "rgba(16, 185, 129, 0.75)",
        upthrust: "rgba(244, 63, 94, 0.75)",
        lps: "rgba(16, 185, 129, 0.65)",
        lpsy: "rgba(244, 63, 94, 0.65)",
        sos: "rgba(34, 197, 94, 0.80)",
        sow: "rgba(239, 68, 68, 0.80)",
        st: "rgba(161, 161, 170, 0.55)",
      },
      effort: {
        bullish: "rgba(16, 185, 129, 0.50)",
        bearish: "rgba(244, 63, 94, 0.50)",
      },
      phase: {
        fill: "rgba(99, 102, 241, 0.04)",
        border: "rgba(99, 102, 241, 0.25)",
      },
    };
  }

  return {
    tradingRange: {
      fill: "rgba(79, 70, 229, 0.05)",
      border: "rgba(79, 70, 229, 0.35)",
    },
    climax: {
      sc: "rgba(225, 29, 72, 0.65)",
      bc: "rgba(5, 150, 105, 0.65)",
    },
    event: {
      spring: "rgba(5, 150, 105, 0.70)",
      upthrust: "rgba(225, 29, 72, 0.70)",
      lps: "rgba(5, 150, 105, 0.60)",
      lpsy: "rgba(225, 29, 72, 0.60)",
      sos: "rgba(22, 163, 74, 0.75)",
      sow: "rgba(220, 38, 38, 0.75)",
      st: "rgba(113, 113, 122, 0.50)",
    },
    effort: {
      bullish: "rgba(5, 150, 105, 0.45)",
      bearish: "rgba(225, 29, 72, 0.45)",
    },
    phase: {
      fill: "rgba(79, 70, 229, 0.03)",
      border: "rgba(79, 70, 229, 0.20)",
    },
  };
};
