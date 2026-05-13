/**
 * Shared boundary types for user-data domain (Hyperliquid API responses).
 *
 * These replace the previously duplicated hand-written types in the frontend
 * and the `unknown` returns in the backend.
 */

// ─── Clearinghouse State ──────────────────────────────────────────────────────

export interface LeverageIsolated {
  readonly type: "isolated";
  readonly value: number;
  readonly rawUsd: string;
}

export interface LeverageCross {
  readonly type: "cross";
  readonly value: number;
}

export type LeverageInfo = LeverageIsolated | LeverageCross;

export interface AssetPosition {
  readonly type: "oneWay";
  readonly position: {
    readonly coin: string;
    readonly szi: string;
    readonly leverage: LeverageInfo;
    readonly entryPx: string;
    readonly positionValue: string;
    readonly unrealizedPnl: string;
    readonly returnOnEquity: string;
    readonly liquidationPx: string | null;
    readonly marginUsed: string;
    readonly maxLeverage: number;
    readonly cumFunding: {
      readonly allTime: string;
      readonly sinceOpen: string;
      readonly sinceChange: string;
    };
  };
}

export interface ClearinghouseState {
  readonly marginSummary: {
    readonly accountValue: string;
    readonly totalNtlPos: string;
    readonly totalRawUsd: string;
    readonly totalMarginUsed: string;
  };
  readonly crossMarginSummary: {
    readonly accountValue: string;
    readonly totalNtlPos: string;
    readonly totalRawUsd: string;
    readonly totalMarginUsed: string;
  };
  readonly crossMaintenanceMarginUsed: string;
  readonly withdrawable: string;
  readonly assetPositions: AssetPosition[];
  readonly time: number;
}

// ─── Spot Clearinghouse State ─────────────────────────────────────────────────

export interface SpotBalance {
  readonly coin: string;
  readonly token: number;
  readonly total: string;
  readonly hold: string;
  readonly entryNtl: string;
}

export interface SpotClearinghouseState {
  readonly balances: SpotBalance[];
  readonly evmEscrows?: Array<{
    readonly coin: string;
    readonly token: number;
    readonly total: string;
  }>;
}

// ─── Open Orders ──────────────────────────────────────────────────────────────

export interface OpenOrder {
  readonly coin: string;
  readonly side: "A" | "B";
  readonly sz: string;
  readonly limitPx: string;
  readonly oid: number;
  readonly timestamp: number;
  readonly origSz?: string;
  readonly orderType?: string | Record<string, unknown>;
  readonly triggerCondition?: string;
  readonly triggerPx?: string;
  readonly isTrigger?: boolean;
  readonly isPositionTpsl?: boolean;
  readonly reduceOnly?: boolean;
  readonly cloid?: string | null;
  readonly tif?: string | null;
}

// ─── Frontend Open Orders (enhanced with children + string orderType) ─────────

export interface FrontendOpenOrder {
  readonly coin: string;
  readonly side: "A" | "B";
  readonly sz: string;
  readonly limitPx: string;
  readonly oid: number;
  readonly timestamp: number;
  readonly origSz: string;
  readonly orderType: string;
  readonly triggerCondition: string;
  readonly triggerPx: string;
  readonly isTrigger: boolean;
  readonly isPositionTpsl: boolean;
  readonly reduceOnly: boolean;
  readonly children: FrontendOpenOrder[];
  readonly cloid: `0x${string}` | null;
  readonly tif: "Gtc" | "Ioc" | "Alo" | "FrontendMarket" | "LiquidationMarket" | null;
}

// ─── Historical Orders ────────────────────────────────────────────────────────

export interface HistoricalOrderEntry {
  readonly order: OpenOrder;
  readonly status: "filled" | "canceled";
  readonly statusTimestamp: number;
}

// ─── User Fills ───────────────────────────────────────────────────────────────

export interface UserFill {
  readonly coin: string;
  readonly side: "A" | "B";
  readonly sz: string;
  readonly px: string;
  readonly fee: string;
  readonly hash: string;
  readonly time: number;
  readonly closedPnl?: string;
}
