/** Asset Context Types - Unified cross-domain context */

import type { Signal, NoiseScore, MarketRegime, TradeDirection } from "./analysis";
import type { AccumulationSignal } from "./treasury";

/** Risk context breakdown */
export interface RiskContext {
  readonly baseRisk: number;
  readonly liquidationMultiplier: number;
  readonly treasuryMultiplier: number;
  readonly finalRisk: number;
  readonly riskLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  readonly explanation: string;
}

/** Treasury context for an asset */
export interface TreasuryContext {
  readonly hasInstitutionalHoldings: boolean;
  readonly totalHoldingsUsd: number;
  readonly entityCount: number;
  readonly percentOfSupply: number;
  readonly netChange30d: number;
  readonly accumulationSignal: AccumulationSignal;
  readonly topHolders: readonly {
    readonly name: string;
    readonly holdingsUsd: number;
    readonly percentOfSupply: number;
  }[];
}

/** Liquidation context */
export interface LiquidationContext {
  readonly hasLiquidationData: boolean;
  readonly nearbyLiquidationRisk: "LOW" | "MEDIUM" | "HIGH";
  readonly dominantSide: "LONG" | "SHORT" | "BALANCED";
  readonly liquidationRatio: number;
  readonly totalLiquidationUsd24h: number;
  readonly dangerZones: readonly {
    readonly price: number;
    readonly volumeUsd: number;
    readonly side: "LONG" | "SHORT";
  }[];
}

/** Derivatives context */
export interface DerivativesContext {
  readonly openInterestUsd: number;
  readonly oiChange24h: number;
  readonly fundingRate: number;
  readonly fundingBias: "LONG_HEAVY" | "SHORT_HEAVY" | "NEUTRAL";
}

/** Unified asset context */
export interface AssetContext {
  readonly symbol: string;
  readonly timestamp: Date;

  /** Price & Market */
  readonly price: number;
  readonly priceChange24h: number;
  readonly marketCap: number;
  readonly volume24h: number;

  /** Technical Analysis */
  readonly signal: Signal;
  readonly confidence: number;
  readonly regime: MarketRegime;
  readonly direction: TradeDirection;
  readonly noise: NoiseScore;

  /** Contextualized Risk */
  readonly riskContext: RiskContext;

  /** Cross-domain Context */
  readonly treasury: TreasuryContext | null;
  readonly liquidation: LiquidationContext | null;
  readonly derivatives: DerivativesContext | null;

  /** Unified Recommendation */
  readonly recommendation: string;
  readonly actionableInsights: readonly string[];
}

/** Context fetch options */
export interface ContextOptions {
  readonly includeTreasury?: boolean;
  readonly includeDerivatives?: boolean;
}
