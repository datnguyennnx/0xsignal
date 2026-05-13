/**
 * @overview Wyckoff Analysis Shared Types
 */
import type { AnalysisFeature } from "../shared";

export type WyckoffFeature = "tradingRange" | "climaxes" | "springs" | "effortResult" | "phases";

export interface WyckoffVisibility {
  readonly tradingRange: boolean;
  readonly climaxes: boolean;
  readonly springs: boolean;
  readonly effortResult: boolean;
  readonly phases: boolean;
}

export const DEFAULT_WYCKOFF_VISIBILITY: WyckoffVisibility = {
  tradingRange: false,
  climaxes: false,
  springs: false,
  effortResult: false,
  phases: false,
};

// Shared UI config for AnalysisButton
export const WYCKOFF_LABEL = "Wyckoff";

export const WYCKOFF_FEATURES: readonly AnalysisFeature[] = [
  {
    id: "tradingRange",
    label: "Trading Range",
    description: "Accumulation/Distribution range",
    color: "bg-foreground/80",
  },
  {
    id: "climaxes",
    label: "Climaxes",
    description: "SC/BC volume spikes",
    color: "bg-foreground/50",
  },
  {
    id: "springs",
    label: "Springs/Upthrusts",
    description: "False breakouts and tests",
    color: "bg-foreground/30",
  },
  {
    id: "effortResult",
    label: "Effort vs Result",
    description: "Volume divergences",
    color: "bg-foreground/60",
  },
  {
    id: "phases",
    label: "Phases",
    description: "Wyckoff phase markers",
    color: "bg-foreground/40",
  },
];

export const WYCKOFF_FOOTER = {
  text: "Best on 1H, 4H, Daily timeframes",
  subtext: "Wyckoff Method by Richard D. Wyckoff",
} as const;
