/**
 * @hyperliquid-api POST /info
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/spot.md
 */

import type { DecimalString } from "../../core/brands";

export type EvmContractDescriptor = {
  address: string;
  evm_extra_wei_decimals: number;
};

export type SpotToken = {
  name: string;
  szDecimals: number;
  weiDecimals: number;
  index: number;
  tokenId: string;
  isCanonical: boolean;
  evmContract: EvmContractDescriptor | string | null;
  fullName: string | null;
};

export type SpotUniverseAsset = {
  name: string;
  tokens: readonly [number, number];
  index: number;
  isCanonical: boolean;
};

export type SpotMetaResponse = {
  tokens: ReadonlyArray<SpotToken>;
  universe: ReadonlyArray<SpotUniverseAsset>;
};

export type SpotAssetCtx = {
  dayNtlVlm: DecimalString;
  markPx: DecimalString;
  midPx: DecimalString | null;
  prevDayPx: DecimalString;
  circulatingSupply?: DecimalString;
  totalSupply?: DecimalString;
};

export type SpotBalance = {
  coin: string;
  token: number;
  hold: DecimalString;
  total: DecimalString;
  entryNtl: DecimalString;
};

export type SpotDeploySpec = {
  name: string;
  szDecimals: number;
  weiDecimals: number;
};

export type SpotDeployState = {
  token: number;
  spec: SpotDeploySpec;
  fullName: string;
  spots: ReadonlyArray<number>;
  maxSupply: number;
  hyperliquidityGenesisBalance: DecimalString;
  totalGenesisBalanceWei: DecimalString;
  userGenesisBalances: ReadonlyArray<readonly [string, DecimalString]>;
  existingTokenGenesisBalances: ReadonlyArray<readonly [number, DecimalString]>;
};

export type SpotGasAuction = {
  startTimeSeconds: number;
  durationSeconds: number;
  startGas: DecimalString;
  currentGas: DecimalString | null;
  endGas: DecimalString | null;
};

export type SpotTokenDetailsGenesis = {
  userBalances: ReadonlyArray<readonly [string, DecimalString]>;
  existingTokenBalances: ReadonlyArray<readonly [number, DecimalString]>;
};

export type SpotOutcomeSideSpec = {
  name: string;
};

export type SpotOutcome = {
  outcome: number;
  name: string;
  description: string;
  sideSpecs: ReadonlyArray<SpotOutcomeSideSpec>;
};

export type SpotOutcomeTemplateRole =
  | string
  | { standaloneOutcome: { sideNames: ReadonlyArray<string> } }
  | { questionOutcome: { parent: string } };

export type SpotOutcomeTemplate = {
  id: string;
  role: SpotOutcomeTemplateRole;
  name: string;
  description: string;
  keywords: ReadonlyArray<readonly [string, string]>;
};

export type SpotSettledOutcomeSpec = {
  outcome: number;
  name: string;
  description: string;
  sideSpecs: ReadonlyArray<SpotOutcomeSideSpec>;
  quoteToken: string;
};

export type SpotMetaInfoRequest = { type: "spotMeta" };
export type SpotMetaInfoResponse = SpotMetaResponse;

export type SpotMetaAndAssetCtxsInfoRequest = { type: "spotMetaAndAssetCtxs" };
export type SpotMetaAndAssetCtxsInfoResponse = readonly [
  SpotMetaInfoResponse,
  ReadonlyArray<SpotAssetCtx>,
];

export type SpotClearinghouseStateInfoRequest = {
  type: "spotClearinghouseState";
  user: string;
};
export type SpotClearinghouseStateInfoResponse = {
  balances: ReadonlyArray<SpotBalance>;
};

export type SpotDeployStateInfoRequest = {
  type: "spotDeployState";
  user: string;
};
export type SpotDeployStateInfoResponse = {
  states: ReadonlyArray<SpotDeployState>;
  gasAuction: SpotGasAuction;
};

export type SpotPairDeployAuctionStatusInfoRequest = {
  type: "spotPairDeployAuctionStatus";
};
export type SpotPairDeployAuctionStatusInfoResponse = SpotGasAuction;

export type SpotTokenDetailsInfoRequest = {
  type: "tokenDetails";
  tokenId: string;
};
export type SpotTokenDetailsInfoResponse = {
  name: string;
  maxSupply: DecimalString;
  totalSupply: DecimalString;
  circulatingSupply: DecimalString;
  szDecimals: number;
  weiDecimals: number;
  midPx: DecimalString;
  markPx: DecimalString;
  prevDayPx: DecimalString;
  genesis: SpotTokenDetailsGenesis;
  deployer: string;
  deployGas: DecimalString;
  deployTime: string;
  seededUsdc: DecimalString;
  nonCirculatingUserBalances: ReadonlyArray<readonly [string, DecimalString]>;
  futureEmissions: DecimalString;
};

export type SpotOutcomeMetaInfoRequest = { type: "outcomeMeta" };
export type SpotOutcomeMetaInfoResponse = {
  outcomes: ReadonlyArray<SpotOutcome>;
};

export type SpotOutcomeTemplatesInfoRequest = { type: "outcomeTemplates" };
export type SpotOutcomeTemplatesInfoResponse = ReadonlyArray<SpotOutcomeTemplate>;

export type SpotSettledOutcomeInfoRequest = {
  type: "settledOutcome";
  outcome: number;
};
export type SpotSettledOutcomeInfoResponse = {
  spec: SpotSettledOutcomeSpec;
  settleFraction: DecimalString;
  details: string;
};

export type SpotOutcomeDeployerLimitsInfoRequest = {
  type: "outcomeDeployerLimits";
  venue: string;
};
export type SpotOutcomeDeployerLimitsInfoResponse = {
  nDailyOutcomesRemaining: number;
  nActiveOutcomesRemaining: number;
};

export type SpotInfoRequest =
  | SpotMetaInfoRequest
  | SpotMetaAndAssetCtxsInfoRequest
  | SpotClearinghouseStateInfoRequest
  | SpotDeployStateInfoRequest
  | SpotPairDeployAuctionStatusInfoRequest
  | SpotTokenDetailsInfoRequest
  | SpotOutcomeMetaInfoRequest
  | SpotOutcomeTemplatesInfoRequest
  | SpotSettledOutcomeInfoRequest
  | SpotOutcomeDeployerLimitsInfoRequest;

export type SpotInfoResponse =
  | SpotMetaInfoResponse
  | SpotMetaAndAssetCtxsInfoResponse
  | SpotClearinghouseStateInfoResponse
  | SpotDeployStateInfoResponse
  | SpotPairDeployAuctionStatusInfoResponse
  | SpotTokenDetailsInfoResponse
  | SpotOutcomeMetaInfoResponse
  | SpotOutcomeTemplatesInfoResponse
  | SpotSettledOutcomeInfoResponse
  | SpotOutcomeDeployerLimitsInfoResponse;
