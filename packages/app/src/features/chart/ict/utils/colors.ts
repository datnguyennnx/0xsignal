export interface ICTColors {
  fvgBullish: { fill: string; border: string; mid: string };
  fvgBearish: { fill: string; border: string; mid: string };
  obBullish: { fill: string; border: string };
  obBearish: { fill: string; border: string };
  ote: { fill: string; line: string; muted: string };
  liquidity: { bsl: string; ssl: string };
  structure: { swing: string; bos: string; choch: { bullish: string; bearish: string } };
}

export const getICTColors = (isDark: boolean): ICTColors => {
  if (isDark) {
    return {
      fvgBullish: {
        fill: "rgba(16, 185, 129, 0.08)",
        border: "rgba(16, 185, 129, 0.45)",
        mid: "rgba(16, 185, 129, 0.20)",
      },
      fvgBearish: {
        fill: "rgba(244, 63, 94, 0.08)",
        border: "rgba(244, 63, 94, 0.45)",
        mid: "rgba(244, 63, 94, 0.20)",
      },
      obBullish: {
        fill: "rgba(16, 185, 129, 0.12)",
        border: "rgba(16, 185, 129, 0.55)",
      },
      obBearish: {
        fill: "rgba(244, 63, 94, 0.12)",
        border: "rgba(244, 63, 94, 0.55)",
      },
      ote: {
        fill: "rgba(251, 191, 36, 0.06)",
        line: "rgba(251, 191, 36, 0.50)",
        muted: "rgba(161, 161, 170, 0.25)",
      },
      liquidity: {
        bsl: "rgba(16, 185, 129, 0.55)",
        ssl: "rgba(244, 63, 94, 0.55)",
      },
      structure: {
        swing: "rgba(161, 161, 170, 0.50)",
        bos: "rgba(161, 161, 170, 0.65)",
        choch: {
          bullish: "rgba(16, 185, 129, 0.85)",
          bearish: "rgba(244, 63, 94, 0.85)",
        },
      },
    };
  }

  return {
    fvgBullish: {
      fill: "rgba(5, 150, 105, 0.06)",
      border: "rgba(5, 150, 105, 0.40)",
      mid: "rgba(5, 150, 105, 0.18)",
    },
    fvgBearish: {
      fill: "rgba(225, 29, 72, 0.06)",
      border: "rgba(225, 29, 72, 0.40)",
      mid: "rgba(225, 29, 72, 0.18)",
    },
    obBullish: {
      fill: "rgba(5, 150, 105, 0.10)",
      border: "rgba(5, 150, 105, 0.50)",
    },
    obBearish: {
      fill: "rgba(225, 29, 72, 0.10)",
      border: "rgba(225, 29, 72, 0.50)",
    },
    ote: {
      fill: "rgba(217, 119, 6, 0.05)",
      line: "rgba(217, 119, 6, 0.45)",
      muted: "rgba(113, 113, 122, 0.22)",
    },
    liquidity: {
      bsl: "rgba(5, 150, 105, 0.50)",
      ssl: "rgba(225, 29, 72, 0.50)",
    },
    structure: {
      swing: "rgba(113, 113, 122, 0.45)",
      bos: "rgba(113, 113, 122, 0.60)",
      choch: {
        bullish: "rgba(5, 150, 105, 0.80)",
        bearish: "rgba(225, 29, 72, 0.80)",
      },
    },
  };
};
