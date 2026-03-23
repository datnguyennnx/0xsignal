/**
 * @overview ICT Analysis Color Palette
 */
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
        fill: "rgba(22, 163, 74, 0.08)",
        border: "rgba(22, 163, 74, 0.45)",
        mid: "rgba(22, 163, 74, 0.20)",
      },
      fvgBearish: {
        fill: "rgba(220, 38, 38, 0.08)",
        border: "rgba(220, 38, 38, 0.45)",
        mid: "rgba(220, 38, 38, 0.20)",
      },
      obBullish: {
        fill: "rgba(22, 163, 74, 0.12)",
        border: "rgba(22, 163, 74, 0.55)",
      },
      obBearish: {
        fill: "rgba(220, 38, 38, 0.12)",
        border: "rgba(220, 38, 38, 0.55)",
      },
      ote: {
        fill: "rgba(161, 161, 170, 0.06)",
        line: "rgba(161, 161, 170, 0.50)",
        muted: "rgba(161, 161, 170, 0.25)",
      },
      liquidity: {
        bsl: "rgba(22, 163, 74, 0.55)",
        ssl: "rgba(220, 38, 38, 0.55)",
      },
      structure: {
        swing: "rgba(161, 161, 170, 0.50)",
        bos: "rgba(161, 161, 170, 0.65)",
        choch: {
          bullish: "rgba(22, 163, 74, 0.85)",
          bearish: "rgba(220, 38, 38, 0.85)",
        },
      },
    };
  }

  return {
    fvgBullish: {
      fill: "rgba(22, 163, 74, 0.06)",
      border: "rgba(22, 163, 74, 0.40)",
      mid: "rgba(22, 163, 74, 0.18)",
    },
    fvgBearish: {
      fill: "rgba(220, 38, 38, 0.06)",
      border: "rgba(220, 38, 38, 0.40)",
      mid: "rgba(220, 38, 38, 0.18)",
    },
    obBullish: {
      fill: "rgba(22, 163, 74, 0.10)",
      border: "rgba(22, 163, 74, 0.50)",
    },
    obBearish: {
      fill: "rgba(220, 38, 38, 0.10)",
      border: "rgba(220, 38, 38, 0.50)",
    },
    ote: {
      fill: "rgba(161, 161, 170, 0.05)",
      line: "rgba(161, 161, 170, 0.45)",
      muted: "rgba(113, 113, 122, 0.22)",
    },
    liquidity: {
      bsl: "rgba(22, 163, 74, 0.50)",
      ssl: "rgba(220, 38, 38, 0.50)",
    },
    structure: {
      swing: "rgba(113, 113, 122, 0.45)",
      bos: "rgba(113, 113, 122, 0.60)",
      choch: {
        bullish: "rgba(22, 163, 74, 0.80)",
        bearish: "rgba(220, 38, 38, 0.80)",
      },
    },
  };
};
