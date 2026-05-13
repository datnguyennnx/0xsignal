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

import { getThemeColor } from "@/core/utils/theme";

export const getICTColors = (): ICTColors => {
  return {
    fvgBullish: {
      fill: getThemeColor("fvg-bullish-fill", "rgba(22, 163, 74, 0.08)"),
      border: getThemeColor("fvg-bullish-border", "rgba(22, 163, 74, 0.45)"),
      mid: getThemeColor("fvg-bullish-mid", "rgba(22, 163, 74, 0.20)"),
    },
    fvgBearish: {
      fill: getThemeColor("fvg-bearish-fill", "rgba(220, 38, 38, 0.08)"),
      border: getThemeColor("fvg-bearish-border", "rgba(220, 38, 38, 0.45)"),
      mid: getThemeColor("fvg-bearish-mid", "rgba(220, 38, 38, 0.20)"),
    },
    obBullish: {
      fill: getThemeColor("ob-bullish-fill", "rgba(22, 163, 74, 0.12)"),
      border: getThemeColor("ob-bullish-border", "rgba(22, 163, 74, 0.55)"),
    },
    obBearish: {
      fill: getThemeColor("ob-bearish-fill", "rgba(220, 38, 38, 0.12)"),
      border: getThemeColor("ob-bearish-border", "rgba(220, 38, 38, 0.55)"),
    },
    ote: {
      fill: getThemeColor("ote-fill", "rgba(161, 161, 170, 0.06)"),
      line: getThemeColor("ote-line", "rgba(161, 161, 170, 0.50)"),
      muted: getThemeColor("ote-muted", "rgba(161, 161, 170, 0.25)"),
    },
    liquidity: {
      bsl: getThemeColor("liquidity-bsl", "rgba(22, 163, 74, 0.55)"),
      ssl: getThemeColor("liquidity-ssl", "rgba(220, 38, 38, 0.55)"),
    },
    structure: {
      swing: getThemeColor("structure-swing", "rgba(161, 161, 170, 0.50)"),
      bos: getThemeColor("structure-bos", "rgba(161, 161, 170, 0.65)"),
      choch: {
        bullish: getThemeColor("structure-choch-bullish", "rgba(22, 163, 74, 0.85)"),
        bearish: getThemeColor("structure-choch-bearish", "rgba(220, 38, 38, 0.85)"),
      },
    },
  };
};
