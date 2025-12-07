/** Asset Context Service - Cross-domain data aggregation */

import { Effect, Context, Layer, Cache, pipe, Array as Arr } from "effect";
import type {
  AssetContext,
  TreasuryContext,
  DerivativesContext,
  ContextOptions,
  OpenInterestData,
  FundingRateData,
} from "@0xsignal/shared";
import { AnalysisServiceTag } from "./analysis";
import { BinanceService } from "../infrastructure/data-sources/binance";
import { TreasuryService } from "../infrastructure/data-sources/coingecko/treasury.provider";
import { CoinGeckoService } from "../infrastructure/data-sources/coingecko";
import type { TreasurySummary } from "../domain/treasury/types";
import { CACHE_TTL, CACHE_CAPACITY } from "../infrastructure/config/app.config";
import { computeRiskContext, classifyFundingBias, generateInsights } from "../domain/context";

const normalizeSymbol = (s: string) => s.toLowerCase().replace("usdt", "");

const SYMBOL_COIN_MAP: Record<string, string> = {
  btc: "bitcoin",
  eth: "ethereum",
  bnb: "binancecoin",
  sol: "solana",
  xrp: "ripple",
  ada: "cardano",
  doge: "dogecoin",
  avax: "avalanche-2",
  dot: "polkadot",
  matic: "matic-network",
  link: "chainlink",
  uni: "uniswap",
  atom: "cosmos",
  ltc: "litecoin",
  bch: "bitcoin-cash",
  xlm: "stellar",
  algo: "algorand",
  vet: "vechain",
  fil: "filecoin",
  trx: "tron",
  etc: "ethereum-classic",
  near: "near",
  apt: "aptos",
  arb: "arbitrum",
  op: "optimism",
  sui: "sui",
  sei: "sei-network",
  inj: "injective-protocol",
  tia: "celestia",
  stx: "blockstack",
  icp: "internet-computer",
  hbar: "hedera-hashgraph",
  ftm: "fantom",
  rune: "thorchain",
  ldo: "lido-dao",
  aave: "aave",
  mkr: "maker",
  crv: "curve-dao-token",
  snx: "synthetix-network-token",
  comp: "compound",
  gmx: "gmx",
  dydx: "dydx",
  pendle: "pendle",
  fet: "fetch-ai",
  rndr: "render-token",
  grt: "the-graph",
  ar: "arweave",
  pepe: "pepe",
  wif: "dogwifhat",
  shib: "shiba-inu",
  floki: "floki",
  bonk: "bonk",
  ton: "the-open-network",
  kas: "kaspa",
  xmr: "monero",
  xlm2: "stellar",
  eos: "eos",
  xtz: "tezos",
  theta: "theta-token",
  neo: "neo",
  egld: "elrond-erd-2",
  sand: "the-sandbox",
  mana: "decentraland",
  axs: "axie-infinity",
  gala: "gala",
  imx: "immutable-x",
  blur: "blur",
  cake: "pancakeswap-token",
  sushi: "sushi",
  joe: "joe",
  ape: "apecoin",
  bitcoin: "bitcoin",
  ethereum: "ethereum",
};

const symbolToCoinId = (symbol: string): string | null =>
  SYMBOL_COIN_MAP[normalizeSymbol(symbol)] ?? null;

const buildTreasuryContext = (summary: TreasurySummary): TreasuryContext => {
  const signal =
    summary.netChange30d > 5
      ? "strong_buy"
      : summary.netChange30d > 0
        ? "buy"
        : summary.netChange30d < -5
          ? "strong_sell"
          : summary.netChange30d < 0
            ? "sell"
            : "neutral";

  return {
    hasInstitutionalHoldings: summary.entityCount > 0,
    totalHoldingsUsd: summary.totalValueUsd,
    entityCount: summary.entityCount,
    percentOfSupply: summary.marketCapDominance,
    netChange30d: summary.netChange30d,
    accumulationSignal: signal,
    topHolders: pipe(
      summary.topHolders,
      Arr.take(3),
      Arr.map((h) => ({
        name: h.entityName,
        holdingsUsd: h.currentValueUsd,
        percentOfSupply: h.percentOfSupply,
      }))
    ),
  };
};

const buildDerivativesContext = (
  oi: OpenInterestData,
  funding: FundingRateData
): DerivativesContext => ({
  openInterestUsd: oi.openInterestUsd,
  oiChange24h: oi.changePercent24h,
  fundingRate: funding.fundingRate,
  fundingBias: classifyFundingBias(funding.fundingRate),
});

export interface ContextService {
  readonly getAssetContext: (
    symbol: string,
    options?: ContextOptions
  ) => Effect.Effect<AssetContext, Error>;
}

export class ContextServiceTag extends Context.Tag("ContextService")<
  ContextServiceTag,
  ContextService
>() {}

export const ContextServiceLive = Layer.effect(
  ContextServiceTag,
  Effect.gen(function* () {
    const analysis = yield* AnalysisServiceTag;
    const binance = yield* BinanceService;
    const treasury = yield* TreasuryService;
    const coinGecko = yield* CoinGeckoService;

    const resolveCoinId = (symbol: string) =>
      Effect.gen(function* () {
        const staticId = symbolToCoinId(symbol);
        if (staticId) return staticId;
        const dynamicId = yield* coinGecko.getCoinId(symbol);
        return dynamicId;
      });

    const fetchTreasury = (coinId: string) =>
      treasury.getHoldingsByCoin(coinId).pipe(
        Effect.map((s): TreasurySummary | null => s),
        Effect.catchAll(() => Effect.succeed(null))
      );

    const fetchOI = (symbol: string) =>
      binance.getOpenInterest(symbol).pipe(
        Effect.map((o): OpenInterestData | null => o),
        Effect.catchAll(() => Effect.succeed(null))
      );

    const fetchFunding = (symbol: string) =>
      binance.getFundingRate(symbol).pipe(
        Effect.map((f): FundingRateData | null => f),
        Effect.catchAll(() => Effect.succeed(null))
      );

    const buildContext = (
      symbol: string,
      options: ContextOptions = {}
    ): Effect.Effect<AssetContext, Error> =>
      Effect.gen(function* () {
        const normalized = normalizeSymbol(symbol);
        const binanceSymbol = `${normalized.toUpperCase()}USDT`;

        const [analysisResult, coinId] = yield* Effect.all(
          [
            analysis.analyzeSymbol(normalized).pipe(Effect.mapError((e) => new Error(e.message))),
            resolveCoinId(symbol),
          ],
          { concurrency: 2 }
        );

        const includeTreasury = options.includeTreasury !== false && coinId !== null;
        const includeDerivatives = options.includeDerivatives !== false;

        const [treasuryData, oiData, fundingData] = yield* Effect.all(
          [
            includeTreasury && coinId ? fetchTreasury(coinId) : Effect.succeed(null),
            includeDerivatives ? fetchOI(binanceSymbol) : Effect.succeed(null),
            includeDerivatives ? fetchFunding(binanceSymbol) : Effect.succeed(null),
          ],
          { concurrency: "unbounded" }
        );

        const treasuryCtx = treasuryData ? buildTreasuryContext(treasuryData) : null;
        const derivativesCtx =
          oiData && fundingData ? buildDerivativesContext(oiData, fundingData) : null;

        const riskContext = computeRiskContext(analysisResult.riskScore, treasuryCtx);
        const insights = generateInsights(
          analysisResult.overallSignal,
          riskContext,
          treasuryCtx,
          derivativesCtx
        );

        return {
          symbol: analysisResult.symbol,
          timestamp: analysisResult.timestamp,
          price: analysisResult.price.price,
          priceChange24h: analysisResult.price.change24h,
          marketCap: analysisResult.price.marketCap,
          volume24h: analysisResult.price.volume24h,
          signal: analysisResult.overallSignal,
          confidence: analysisResult.confidence,
          regime: analysisResult.strategyResult.regime,
          direction: analysisResult.entrySignal.direction,
          noise: analysisResult.noise,
          riskContext,
          treasury: treasuryCtx,
          derivatives: derivativesCtx,
          recommendation: analysisResult.recommendation,
          actionableInsights: insights,
        };
      });

    const cache = yield* Cache.make({
      capacity: CACHE_CAPACITY.LARGE,
      timeToLive: CACHE_TTL.ANALYSIS,
      lookup: (key: string) => {
        const [symbol, opts] = key.split("|");
        const options: ContextOptions = opts ? JSON.parse(opts) : {};
        return buildContext(symbol, options);
      },
    });

    return {
      getAssetContext: (symbol, options = {}) => {
        const key = `${symbol}|${JSON.stringify(options)}`;
        return cache.get(key);
      },
    };
  })
);
