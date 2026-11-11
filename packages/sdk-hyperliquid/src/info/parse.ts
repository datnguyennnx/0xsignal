/**
 * @hyperliquid-api POST /info (parsers)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint.md
 */

import type { DecimalString } from "../core/brands";
import { ValidationError } from "../core/errors";
import { arr, bool, cast, decimal, nullable, num, obj, str } from "../core/parse";
import type {
  AllMidsInfoResponse,
  CandleSnapshotInfoResponse,
  ClearinghouseStateInfoResponse,
  HistoricalOrdersInfoResponse,
  L2BookInfoResponse,
  MaxBuilderFeeInfoResponse,
  MetaAndAssetCtxsInfoResponse,
  MetaInfoResponse,
  OrderStatusInfoResponse,
  SpotClearinghouseStateInfoResponse,
  SpotMetaAndAssetCtxsInfoResponse,
  UserAbstractionInfoResponse,
  UserDexAbstractionInfoResponse,
  UserFillsInfoResponse,
  UserFundingInfoResponse,
} from "./types";
import type { EvmContractDescriptor } from "./types/spot";

export const GENERAL_PAGE_CAP = 500;
export const USER_FILLS_PAGE_CAP = 2000;
export const USER_FILLS_BY_TIME_PAGE_CAP = 2000;
export const USER_FILLS_BY_TIME_AVAILABLE_CAP = 10_000;
export const HISTORICAL_ORDERS_PAGE_CAP = 2000;
export const USER_TWAP_SLICE_FILLS_PAGE_CAP = 2000;
export const CANDLE_SNAPSHOT_PAGE_CAP = 5000;
export const L2_BOOK_LEVELS_PER_SIDE = 20;

export function pageEnd(startTime: number, pageSize: number): number {
  return startTime + pageSize;
}

export function decimalAt(
  record: Record<string, unknown>,
  key: string,
  path: string,
): DecimalString {
  return decimal(record[key], `${path}.${key}`);
}

export function numAt(record: Record<string, unknown>, key: string, path: string): number {
  return num(record[key], `${path}.${key}`);
}

export function boolAt(record: Record<string, unknown>, key: string, path: string): boolean {
  return bool(record[key], `${path}.${key}`);
}

export function arrAt(
  record: Record<string, unknown>,
  key: string,
  path: string,
): readonly unknown[] {
  return arr(record[key], `${path}.${key}`);
}

export function nullableAt<T>(
  record: Record<string, unknown>,
  key: string,
  path: string,
  parse: (v: unknown, p: string) => T,
): T | null {
  return nullable(parse)(record[key], `${path}.${key}`);
}

export const parseAllMids = (u: unknown): AllMidsInfoResponse =>
  cast<AllMidsInfoResponse>(obj(u, "allMids"), "allMids");

export const parseMaxBuilderFee = (u: unknown): MaxBuilderFeeInfoResponse =>
  num(u, "maxBuilderFee");

export const parseUserDexAbstraction = (u: unknown): UserDexAbstractionInfoResponse =>
  bool(u, "userDexAbstraction");

export const parseUserAbstraction = (u: unknown): UserAbstractionInfoResponse =>
  cast<UserAbstractionInfoResponse>(str(u, "userAbstraction"), "userAbstraction");

export const parseOrderStatus = (u: unknown): OrderStatusInfoResponse => {
  const o = obj(u, "orderStatus");
  const status = str(o["status"], "orderStatus.status");
  if (status !== "order" && status !== "unknownOid") {
    throw new ValidationError("orderStatus.status", "order | unknownOid");
  }
  return cast<OrderStatusInfoResponse>(o, "orderStatus");
};

const parseMarginSummary = (u: unknown, path: string): void => {
  const o = obj(u, path);
  decimalAt(o, "accountValue", path);
  decimalAt(o, "totalMarginUsed", path);
  decimalAt(o, "totalNtlPos", path);
  decimalAt(o, "totalRawUsd", path);
};

const parsePosition = (u: unknown, path: string): void => {
  const o = obj(u, path);
  decimalAt(o, "szi", path);
  decimalAt(o, "entryPx", path);
  decimalAt(o, "positionValue", path);
  decimalAt(o, "unrealizedPnl", path);
  decimalAt(o, "returnOnEquity", path);
  decimalAt(o, "marginUsed", path);
  const leverage = obj(o["leverage"], `${path}.leverage`);
  numAt(leverage, "value", `${path}.leverage`);
  nullableAt(o, "liquidationPx", path, decimal);
};

export const parseClearinghouseState = (u: unknown): ClearinghouseStateInfoResponse => {
  const path = "clearinghouseState";
  const o = obj(u, path);
  parseMarginSummary(o["marginSummary"], `${path}.marginSummary`);
  decimalAt(o, "withdrawable", path);
  const positions = arrAt(o, "assetPositions", path);
  positions.forEach((entry, index) => {
    const entryPath = `${path}.assetPositions[${index}]`;
    const position = obj(obj(entry, entryPath)["position"], `${entryPath}.position`);
    parsePosition(position, `${entryPath}.position`);
  });
  return cast<ClearinghouseStateInfoResponse>(o, path);
};

export const parseL2Book = (u: unknown): L2BookInfoResponse => {
  const path = "l2Book";
  const o = obj(u, path);
  const levels = arrAt(o, "levels", path);
  if (levels.length !== 2) throw new ValidationError(`${path}.levels`, "2-tuple");
  levels.forEach((side, sideIndex) => {
    const sidePath = `${path}.levels[${sideIndex}]`;
    arr(side, sidePath).forEach((level, levelIndex) => {
      const levelPath = `${sidePath}[${levelIndex}]`;
      const l = obj(level, levelPath);
      decimalAt(l, "px", levelPath);
      decimalAt(l, "sz", levelPath);
      numAt(l, "n", levelPath);
    });
  });
  return cast<L2BookInfoResponse>(o, path);
};

const parseFill = (u: unknown, path: string): void => {
  const o = obj(u, path);
  decimalAt(o, "px", path);
  decimalAt(o, "sz", path);
  decimalAt(o, "fee", path);
  decimalAt(o, "closedPnl", path);
  decimalAt(o, "startPosition", path);
  numAt(o, "oid", path);
  numAt(o, "tid", path);
  numAt(o, "time", path);
  if (o["builderFee"] !== undefined) decimalAt(o, "builderFee", path);
};

export const parseUserFills = (u: unknown): UserFillsInfoResponse => {
  const path = "userFills";
  const fills = arr(u, path);
  fills.forEach((fill, index) => {
    parseFill(fill, `${path}[${index}]`);
  });
  return cast<UserFillsInfoResponse>(fills, path);
};

export const parseCandleSnapshot = (u: unknown): CandleSnapshotInfoResponse => {
  const path = "candleSnapshot";
  const candles = arr(u, path);
  candles.forEach((candle, index) => {
    const candlePath = `${path}[${index}]`;
    const c = obj(candle, candlePath);
    decimalAt(c, "o", candlePath);
    decimalAt(c, "h", candlePath);
    decimalAt(c, "l", candlePath);
    decimalAt(c, "c", candlePath);
    decimalAt(c, "v", candlePath);
    numAt(c, "t", candlePath);
    numAt(c, "T", candlePath);
    numAt(c, "n", candlePath);
  });
  return cast<CandleSnapshotInfoResponse>(candles, path);
};

export const parseSpotClearinghouseState = (u: unknown): SpotClearinghouseStateInfoResponse => {
  const path = "spotClearinghouseState";
  const o = obj(u, path);
  const balances = arrAt(o, "balances", path);
  balances.forEach((balance, index) => {
    const balancePath = `${path}.balances[${index}]`;
    const b = obj(balance, balancePath);
    decimalAt(b, "total", balancePath);
    decimalAt(b, "hold", balancePath);
    decimalAt(b, "entryNtl", balancePath);
    numAt(b, "token", balancePath);
  });
  return cast<SpotClearinghouseStateInfoResponse>(o, path);
};

const parseMarginTable = (u: unknown, path: string): void => {
  const tuple = arr(u, path);
  if (tuple.length !== 2) throw new ValidationError(path, "2-tuple");
  num(tuple[0], `${path}[0]`);
  const body = obj(tuple[1], `${path}[1]`);
  str(body["description"], `${path}[1].description`);
  const tiers = arr(body["marginTiers"], `${path}[1].marginTiers`);
  tiers.forEach((tier, index) => {
    const tierPath = `${path}[1].marginTiers[${index}]`;
    const t = obj(tier, tierPath);
    decimalAt(t, "lowerBound", tierPath);
    numAt(t, "maxLeverage", tierPath);
  });
};

const parseMetaAt = (u: unknown, path: string): MetaInfoResponse => {
  const o = obj(u, path);
  const universe = arrAt(o, "universe", path);
  universe.forEach((asset, index) => {
    const assetPath = `${path}.universe[${index}]`;
    const a = obj(asset, assetPath);
    str(a["name"], `${assetPath}.name`);
    numAt(a, "szDecimals", assetPath);
    numAt(a, "maxLeverage", assetPath);
  });
  const marginTables = arrAt(o, "marginTables", path);
  marginTables.forEach((table, index) => {
    parseMarginTable(table, `${path}.marginTables[${index}]`);
  });
  return cast<MetaInfoResponse>(o, path);
};

export const parseMeta = (u: unknown): MetaInfoResponse => parseMetaAt(u, "meta");

const parsePerpAssetCtx = (u: unknown, path: string): void => {
  const o = obj(u, path);
  decimalAt(o, "funding", path);
  decimalAt(o, "markPx", path);
  decimalAt(o, "oraclePx", path);
};

export const parseMetaAndAssetCtxs = (u: unknown): MetaAndAssetCtxsInfoResponse => {
  const path = "metaAndAssetCtxs";
  const tuple = arr(u, path);
  if (tuple.length !== 2) throw new ValidationError(path, "2-tuple");
  parseMetaAt(tuple[0], `${path}[0]`);
  const ctxs = arr(tuple[1], `${path}[1]`);
  ctxs.forEach((ctx, index) => {
    parsePerpAssetCtx(ctx, `${path}[1][${index}]`);
  });
  return cast<MetaAndAssetCtxsInfoResponse>(tuple, path);
};

export const parseUserFunding = (u: unknown): UserFundingInfoResponse => {
  const path = "userFunding";
  const updates = arr(u, path);
  updates.forEach((update, index) => {
    const updatePath = `${path}[${index}]`;
    const entry = obj(update, updatePath);
    const deltaPath = `${updatePath}.delta`;
    const delta = obj(entry["delta"], deltaPath);
    str(delta["coin"], `${deltaPath}.coin`);
    decimalAt(delta, "fundingRate", deltaPath);
    decimalAt(delta, "szi", deltaPath);
    decimalAt(delta, "usdc", deltaPath);
    nullableAt(delta, "nSamples", deltaPath, num);
    numAt(entry, "time", updatePath);
  });
  return cast<UserFundingInfoResponse>(updates, path);
};

const parseOrder = (u: unknown, path: string): void => {
  const o = obj(u, path);
  decimalAt(o, "limitPx", path);
  decimalAt(o, "sz", path);
  decimalAt(o, "triggerPx", path);
  decimalAt(o, "origSz", path);
  numAt(o, "oid", path);
  numAt(o, "timestamp", path);
};

export const parseHistoricalOrders = (u: unknown): HistoricalOrdersInfoResponse => {
  const path = "historicalOrders";
  const orders = arr(u, path);
  orders.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    const o = obj(entry, entryPath);
    parseOrder(o["order"], `${entryPath}.order`);
    numAt(o, "statusTimestamp", entryPath);
  });
  return cast<HistoricalOrdersInfoResponse>(orders, path);
};

const parseEvmContract = (u: unknown, path: string): EvmContractDescriptor | string | null => {
  if (u === null || typeof u === "string") return u;
  const o = obj(u, path);
  str(o["address"], `${path}.address`);
  num(o["evm_extra_wei_decimals"], `${path}.evm_extra_wei_decimals`);
  return cast<EvmContractDescriptor>(o, path);
};

const parseSpotMetaTokens = (u: unknown, path: string): void => {
  const o = obj(u, path);
  const tokens = arrAt(o, "tokens", path);
  tokens.forEach((token, index) => {
    const tokenPath = `${path}.tokens[${index}]`;
    const t = obj(token, tokenPath);
    if (t["evmContract"] !== undefined) {
      parseEvmContract(t["evmContract"], `${tokenPath}.evmContract`);
    }
  });
};

export const parseSpotMetaAndAssetCtxs = (u: unknown): SpotMetaAndAssetCtxsInfoResponse => {
  const path = "spotMetaAndAssetCtxs";
  const tuple = arr(u, path);
  if (tuple.length !== 2) throw new ValidationError(path, "2-tuple");
  parseSpotMetaTokens(tuple[0], `${path}[0]`);
  return cast<SpotMetaAndAssetCtxsInfoResponse>(tuple, path);
};

export const parseUnknown = (u: unknown): unknown => u;
