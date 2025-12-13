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
