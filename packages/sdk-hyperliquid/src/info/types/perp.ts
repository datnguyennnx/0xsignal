/**
 * @hyperliquid-api POST /info
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals.md
 */

import type { DecimalString } from "../../core/brands";

export type PerpAssetCtx = {
  funding: DecimalString;
  openInterest: DecimalString;
  prevDayPx: DecimalString;
  dayNtlVlm: DecimalString;
  premium: DecimalString | null;
  oraclePx: DecimalString;
  markPx: DecimalString;
  midPx: DecimalString | null;
  impactPxs: readonly [DecimalString, DecimalString] | null;
  dayBaseVlm?: DecimalString;
};

export type MarginSummary = {
  accountValue: DecimalString;
  totalMarginUsed: DecimalString;
  totalNtlPos: DecimalString;
  totalRawUsd: DecimalString;
};

export type Position = {
  coin: string;
  cumFunding: { allTime: DecimalString; sinceChange: DecimalString; sinceOpen: DecimalString };
  entryPx: DecimalString;
  leverage: { rawUsd: DecimalString; type: "cross" | "isolated"; value: number };
  liquidationPx: DecimalString | null;
  marginUsed: DecimalString;
  maxLeverage: number;
  positionValue: DecimalString;
  returnOnEquity: DecimalString;
  szi: DecimalString;
  unrealizedPnl: DecimalString;
};

export type ClearinghouseState = {
  assetPositions: ReadonlyArray<{ position: Position; type: "oneWay" }>;
  crossMaintenanceMarginUsed: DecimalString;
  crossMarginSummary: MarginSummary;
  marginSummary: MarginSummary;
  time: number;
  withdrawable: DecimalString;
};

export type MetaInfoResponse = {
  universe: ReadonlyArray<{
    name: string;
    szDecimals: number;
    maxLeverage: number;
    onlyIsolated?: boolean;
    isDelisted?: boolean;
    marginMode?: "strictIsolated" | "noCross";
    marginTableId?: number;
    growthMode?: string;
    lastGrowthModeChangeTime?: string;
  }>;
  marginTables: ReadonlyArray<
    readonly [
      number,
      {
        description: string;
        marginTiers: ReadonlyArray<{ lowerBound: DecimalString; maxLeverage: number }>;
      },
    ]
  >;
};

export type NonFundingDelta =
  | { type: "deposit"; usdc: DecimalString }
  | { type: "withdraw"; usdc: DecimalString; nonce: number; fee: DecimalString }
  | {
      type: "internalTransfer";
      usdc: DecimalString;
      user: string;
      destination: string;
      fee: DecimalString;
    }
  | { type: "subAccountTransfer"; usdc: DecimalString; user: string; destination: string }
  | { type: "accountClassTransfer"; usdc: DecimalString; toPerp: boolean }
  | {
      type: "spotTransfer";
      token: string;
      amount: DecimalString;
      usdcValue: DecimalString;
      user: string;
      destination: string;
      fee: DecimalString;
    }
  | {
      type: "vaultCreate" | "vaultDeposit" | "vaultDistribution";
      vault: string;
      usdc: DecimalString;
    }
  | {
      type: "vaultWithdraw";
      vault: string;
      user: string;
      requestedUsd: DecimalString;
      commission: DecimalString;
      closingCost: DecimalString;
      basis: DecimalString;
      netWithdrawnUsd: DecimalString;
    }
  | { type: "vaultLeaderCommission"; user: string; usdc: DecimalString }
  | { type: "rewardsClaim"; amount: DecimalString }
  | { type: "spotGenesis"; token: string; amount: DecimalString }
  | {
      type: "liquidation";
      accountValue: DecimalString;
      leverageType: "Cross" | "Isolated";
      liquidatedPositions: ReadonlyArray<{ coin: string; szi: DecimalString }>;
    };

export type PerpDexsInfoRequest = { type: "perpDexs" };
export type PerpDexsInfoResponse = ReadonlyArray<null | {
  name: string;
  fullName: string;
  deployer: string;
  oracleUpdater: string | null;
  feeRecipient: string | null;
  assetToStreamingOiCap: ReadonlyArray<readonly [string, DecimalString]> | null;
  assetToFundingMultiplier: ReadonlyArray<readonly [string, DecimalString]> | null;
}>;

export type MetaInfoRequest = { type: "meta"; dex?: string };

export type MetaAndAssetCtxsInfoRequest = { type: "metaAndAssetCtxs"; dex?: string };
export type MetaAndAssetCtxsInfoResponse = readonly [MetaInfoResponse, ReadonlyArray<PerpAssetCtx>];

export type ClearinghouseStateInfoRequest = {
  type: "clearinghouseState";
  user: string;
  dex?: string;
};
export type ClearinghouseStateInfoResponse = ClearinghouseState;

export type UserFundingInfoRequest = {
  type: "userFunding";
  user: string;
  startTime: number;
  endTime?: number;
};
export type UserFundingInfoResponse = ReadonlyArray<{
  delta: {
    coin: string;
    fundingRate: DecimalString;
    szi: DecimalString;
    type: "funding";
    usdc: DecimalString;
    nSamples: number | null;
  };
  hash: string;
  time: number;
}>;

export type UserNonFundingLedgerUpdatesInfoRequest = {
  type: "userNonFundingLedgerUpdates";
  user: string;
  startTime: number;
  endTime?: number;
};
export type UserNonFundingLedgerUpdatesInfoResponse = ReadonlyArray<{
  time: number;
  hash: string;
  delta: NonFundingDelta;
}>;

export type FundingHistoryInfoRequest = {
  type: "fundingHistory";
  coin: string;
  startTime: number;
  endTime?: number;
};
export type FundingHistoryInfoResponse = ReadonlyArray<{
  coin: string;
  fundingRate: DecimalString;
  premium: DecimalString;
  time: number;
}>;

export type PredictedFundingsInfoRequest = { type: "predictedFundings" };
export type PredictedFundingsInfoResponse = ReadonlyArray<
  readonly [
    string,
    ReadonlyArray<
      readonly [string, { fundingRate: DecimalString; nextFundingTime: number } | null]
    >,
  ]
>;

export type PerpsAtOpenInterestCapInfoRequest = {
  type: "perpsAtOpenInterestCap";
  dex?: string;
};
export type PerpsAtOpenInterestCapInfoResponse = ReadonlyArray<string>;

export type PerpDeployAuctionStatusInfoRequest = { type: "perpDeployAuctionStatus" };
export type PerpDeployAuctionStatusInfoResponse = {
  startTimeSeconds: number;
  durationSeconds: number;
  startGas: DecimalString;
  currentGas: DecimalString | null;
  endGas: DecimalString | null;
};

export type ActiveAssetDataInfoRequest = {
  type: "activeAssetData";
  user: string;
  coin: string;
};
export type ActiveAssetDataInfoResponse = {
  user: string;
  coin: string;
  leverage: { type: "cross" | "isolated"; value: number; rawUsd?: DecimalString };
  maxTradeSzs: readonly [DecimalString, DecimalString];
  availableToTrade: readonly [DecimalString, DecimalString];
  markPx: DecimalString;
};

export type PerpDexLimitsInfoRequest = { type: "perpDexLimits"; dex: string };
export type PerpDexLimitsInfoResponse = {
  totalOiCap: DecimalString;
  oiSzCapPerPerp: DecimalString;
  maxTransferNtl: DecimalString;
  coinToOiCap: ReadonlyArray<readonly [string, DecimalString]>;
};

export type PerpDexStatusInfoRequest = { type: "perpDexStatus"; dex: string };
export type PerpDexStatusInfoResponse = { totalNetDeposit: DecimalString };

export type AllPerpMetasInfoRequest = { type: "allPerpMetas" };
export type AllPerpMetasInfoResponse = ReadonlyArray<
  readonly [MetaInfoResponse, ReadonlyArray<PerpAssetCtx>]
>;

export type PerpAnnotationInfoRequest = { type: "perpAnnotation"; coin: string };
export type PerpAnnotationInfoResponse = { category: string; description: string };

export type PerpCategoriesInfoRequest = { type: "perpCategories" };
export type PerpCategoriesInfoResponse = ReadonlyArray<readonly [string, string]>;

export type PerpConciseAnnotationsInfoRequest = { type: "perpConciseAnnotations" };
export type PerpConciseAnnotationsInfoResponse = ReadonlyArray<
  readonly [string, { category: string; keywords?: ReadonlyArray<string> }]
>;

export type UserStarStateInfoRequest = { type: "userStarState"; user: string };

export type PerpInfoRequest =
  | PerpDexsInfoRequest
  | MetaInfoRequest
  | MetaAndAssetCtxsInfoRequest
  | ClearinghouseStateInfoRequest
  | UserFundingInfoRequest
  | UserNonFundingLedgerUpdatesInfoRequest
  | FundingHistoryInfoRequest
  | PredictedFundingsInfoRequest
  | PerpsAtOpenInterestCapInfoRequest
  | PerpDeployAuctionStatusInfoRequest
  | ActiveAssetDataInfoRequest
  | PerpDexLimitsInfoRequest
  | PerpDexStatusInfoRequest
  | AllPerpMetasInfoRequest
  | PerpAnnotationInfoRequest
  | PerpCategoriesInfoRequest
  | PerpConciseAnnotationsInfoRequest
  | UserStarStateInfoRequest;

export type PerpInfoResponse =
  | PerpDexsInfoResponse
  | MetaInfoResponse
  | MetaAndAssetCtxsInfoResponse
  | ClearinghouseStateInfoResponse
  | UserFundingInfoResponse
  | UserNonFundingLedgerUpdatesInfoResponse
  | FundingHistoryInfoResponse
  | PredictedFundingsInfoResponse
  | PerpsAtOpenInterestCapInfoResponse
  | PerpDeployAuctionStatusInfoResponse
  | ActiveAssetDataInfoResponse
  | PerpDexLimitsInfoResponse
  | PerpDexStatusInfoResponse
  | AllPerpMetasInfoResponse
  | PerpAnnotationInfoResponse
  | PerpCategoriesInfoResponse
  | PerpConciseAnnotationsInfoResponse;
