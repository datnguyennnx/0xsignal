import { ValidationError } from "../core/errors";
import { MAX_DECIMALS_PERP, MAX_DECIMALS_SPOT } from "../core/trade-rules";
import type { MetaInfoResponse } from "../info/types/perp";
import type { SpotMetaInfoResponse } from "../info/types/spot";

export type AssetInfo = {
  readonly name: string;
  readonly assetId: number;
  readonly szDecimals: number;
  readonly maxDecimals: 6 | 8;
  readonly isSpot: boolean;
  readonly dex?: string;
};

export type AssetMetaOptions = {
  readonly isSpot?: boolean;
  readonly dex?: string;
  readonly dexIndex?: number;
};

const SPOT_ASSET_BASE = 10_000;
const BUILDER_DEX_BASE = 100_000;
const DEX_STRIDE = 10_000;

const builderDexAssetId = (dexIndex: number, index: number): number => {
  if (!Number.isSafeInteger(dexIndex) || dexIndex < 0) {
    throw new ValidationError("opts.dexIndex", "non-negative integer");
  }
  return BUILDER_DEX_BASE + dexIndex * DEX_STRIDE + index;
};

export function assetInfoFromMeta(
  meta: MetaInfoResponse,
  symbol: string,
  opts: AssetMetaOptions = {},
): AssetInfo {
  if (opts.isSpot === true) {
    throw new ValidationError("opts.isSpot", "false; use assetInfoFromSpotMeta for spot pairs");
  }
  const entry = meta.universe.find((asset) => asset.name === symbol);
  if (entry === undefined) {
    throw new ValidationError(`meta.universe["${symbol}"]`, "listed perp symbol");
  }
  const index = meta.universe.indexOf(entry);
  const assetId = opts.dexIndex === undefined ? index : builderDexAssetId(opts.dexIndex, index);
  if (opts.dex === undefined) {
    return {
      name: entry.name,
      assetId,
      szDecimals: entry.szDecimals,
      maxDecimals: MAX_DECIMALS_PERP,
      isSpot: false,
    };
  }
  return {
    name: entry.name,
    assetId,
    szDecimals: entry.szDecimals,
    maxDecimals: MAX_DECIMALS_PERP,
    isSpot: false,
    dex: opts.dex,
  };
}

export function assetInfoFromSpotMeta(spot: SpotMetaInfoResponse, pair: string): AssetInfo {
  const entry = spot.universe.find((asset) => asset.name === pair);
  if (entry === undefined) {
    throw new ValidationError(`spotMeta.universe["${pair}"]`, "listed spot pair");
  }
  const [baseTokenIndex] = entry.tokens;
  if (baseTokenIndex === undefined) {
    throw new ValidationError(
      `spotMeta.universe["${pair}"].tokens`,
      "base token index at position 0",
    );
  }
  const baseToken = spot.tokens.find((token) => token.index === baseTokenIndex);
  if (baseToken === undefined) {
    throw new ValidationError(
      `spotMeta.tokens[${baseTokenIndex}]`,
      `token backing spot pair "${pair}"`,
    );
  }
  return {
    name: entry.name,
    assetId: SPOT_ASSET_BASE + entry.index,
    szDecimals: baseToken.szDecimals,
    maxDecimals: MAX_DECIMALS_SPOT,
    isSpot: true,
  };
}
