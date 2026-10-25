import { Result } from "effect";
import { normalizeSymbol, parseSymbol } from "./symbol";
import { TickerSnapshotError } from "./errors";
import type {
  MarketAssetCtxItem,
  MarketUniverseItem,
  TickerPayload,
  TickerSnapshot,
} from "./types";

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const mapTickerFromSnapshot = (
  snapshot: TickerSnapshot,
  symbol: string,
): Result.Result<TickerPayload, TickerSnapshotError> => {
  // Spot symbols not in perp universe. Return mid price from allMids,
  // set prevDayPx/dayNtlVlm to null (unknown) rather than 0 (misleading).
  if (parseSymbol(symbol).kind === "spot") {
    const spotMid = snapshot.allMids[symbol];
    const midPx = toNumberOrNull(spotMid) ?? 0;
    return Result.succeed({
      symbol,
      mid: midPx,
      markPx: midPx,
      midPx: midPx,
      prevDayPx: null,
      dayNtlVlm: null,
      openInterest: 0,
      funding: 0,
    });
  }

  const normalizedSymbol = normalizeSymbol(symbol);
  if (!normalizedSymbol) {
    return Result.fail(
      new TickerSnapshotError({
        message: "Symbol is required",
        kind: "BAD_REQUEST",
      }),
    );
  }

  // Build lookup candidates:
  //   - DEX-prefixed "xyz:YEETI" → try "xyz:YEETI" and bare "YEETI"
  //   - Bare "BTC" → try "BTC" only
  const lookupSymbols = [symbol, normalizedSymbol];
  if (normalizedSymbol.includes(":")) {
    const bare = normalizedSymbol.split(":").slice(1).join(":");
    lookupSymbols.push(bare);
  }

  const marketIndex = snapshot.universe.findIndex(
    (item) =>
      lookupSymbols.includes(item.name) || lookupSymbols.includes(normalizeSymbol(item.name)),
  );
  let ctx: MarketAssetCtxItem | undefined;

  if (marketIndex >= 0) {
    ctx = snapshot.assetCtxs[marketIndex];
  }

  const hasAllMidsSymbol = lookupSymbols.some((s) => typeof snapshot.allMids[s] === "string");

  if (!ctx && !hasAllMidsSymbol) {
    return Result.fail(
      new TickerSnapshotError({
        message: `Symbol not found: ${symbol}`,
        kind: "NOT_FOUND",
      }),
    );
  }

  let fallbackMid: string | undefined;
  for (const candidate of lookupSymbols) {
    fallbackMid ??= snapshot.allMids[candidate];
  }
  const mid =
    toNumberOrNull(ctx?.midPx) ?? toNumberOrNull(ctx?.markPx) ?? toNumberOrNull(fallbackMid);

  return Result.succeed({
    symbol: normalizedSymbol,
    mid,
    markPx: toNumberOrNull(ctx?.markPx) ?? mid,
    midPx: toNumberOrNull(ctx?.midPx) ?? mid,
    prevDayPx: toNumberOrNull(ctx?.prevDayPx),
    dayNtlVlm: toNumberOrNull(ctx?.dayNtlVlm),
    openInterest: toNumberOrNull(ctx?.openInterest) ?? 0,
    funding: toNumberOrNull(ctx?.funding) ?? 0,
  });
};

export const isPerpSymbol = (snapshot: TickerSnapshot, symbol: string): boolean => {
  // Spot symbols are NEVER perps
  if (parseSymbol(symbol).kind === "spot") return false;

  const normalized = normalizeSymbol(symbol);
  const unprefixed = normalized.includes(":")
    ? normalized.split(":").slice(1).join(":")
    : undefined;

  return snapshot.universe.some(
    (u) =>
      u.name === symbol ||
      u.name === normalized ||
      normalizeSymbol(u.name) === normalized ||
      (unprefixed !== undefined &&
        (u.name === unprefixed || normalizeSymbol(u.name) === unprefixed)),
  );
};

const bareCoinName = (name: string): string => {
  const normalized = normalizeSymbol(name);
  return normalized.includes(":") ? normalized.split(":").slice(1).join(":") : normalized;
};

const dexNameOf = (snapshot: TickerSnapshot, item: MarketUniverseItem): string =>
  snapshot.dexNames?.[item.dexIndex ?? 0] ?? "";

/** The upstream query coin: builder perps are always `{dex}:{coin}`. */
const internalNameOf = (snapshot: TickerSnapshot, item: MarketUniverseItem): string => {
  const dex = dexNameOf(snapshot, item);
  return dex === "" ? item.name : `${dex}:${bareCoinName(item.name)}`;
};

const searchedDexes = (snapshot: TickerSnapshot): ReadonlyArray<string> => {
  const names = (snapshot.dexNames ?? [""]).map((dex) => (dex === "" ? "main" : dex));
  return snapshot.spotPairs === undefined ? names : [...names, "spot"];
};

const triedForms = (coin: string, snapshot: TickerSnapshot): ReadonlyArray<string> => {
  const builderForms = (snapshot.dexNames ?? [])
    .filter((dex) => dex !== "")
    .map((dex) => `${dex}:${coin}`);
  return [coin, `${coin}/USDC`, ...builderForms];
};

const notFoundError = (
  symbol: string,
  tried: ReadonlyArray<string>,
  dexes: ReadonlyArray<string>,
): TickerSnapshotError =>
  new TickerSnapshotError({
    message: `Symbol not found: ${symbol} (tried ${tried.join(", ")}; searched ${dexes.join(", ")})`,
    kind: "NOT_FOUND",
    reason: "NOT_FOUND",
    symbol,
    tried,
    dexes,
  });

const delistedError = (
  symbol: string,
  resolved: string,
  tried: ReadonlyArray<string>,
  dexes: ReadonlyArray<string>,
): TickerSnapshotError =>
  new TickerSnapshotError({
    message: `Symbol is delisted and not tradable: ${symbol} (resolved ${resolved})`,
    kind: "NOT_FOUND",
    reason: "DELISTED",
    symbol,
    resolved,
    tried,
    dexes,
  });

const ambiguousError = (
  symbol: string,
  candidates: ReadonlyArray<string>,
  tried: ReadonlyArray<string>,
  dexes: ReadonlyArray<string>,
): TickerSnapshotError =>
  new TickerSnapshotError({
    message: `Symbol is ambiguous: ${symbol} (qualify one of ${candidates.join(", ")})`,
    kind: "BAD_REQUEST",
    reason: "AMBIGUOUS",
    symbol,
    candidates,
    tried,
    dexes,
  });

/**
 * Resolves a user symbol to the upstream query coin. Bare names search the main
 * dex, then spot pairs, then every builder dex; two builder matches are an
 * ambiguity rather than a guess. The `k` prefix is never substituted.
 */
export const resolveInternalSymbol = (
  snapshot: TickerSnapshot,
  symbol: string,
): Result.Result<string, TickerSnapshotError> => {
  // Spot pair identifiers ("PURR/USDC") pass through — they are exact SDK identifiers.
  if (parseSymbol(symbol).kind === "spot") return Result.succeed(symbol);

  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    return Result.fail(
      new TickerSnapshotError({ message: "Symbol is required", kind: "BAD_REQUEST" }),
    );
  }

  const dexes = searchedDexes(snapshot);

  if (normalized.includes(":")) {
    const exact =
      snapshot.universe.find((item) => normalizeSymbol(item.name) === normalized) ??
      snapshot.universe.find(
        (item) => `${dexNameOf(snapshot, item)}:${bareCoinName(item.name)}` === normalized,
      );
    if (exact === undefined) return Result.fail(notFoundError(symbol, [normalized], dexes));
    if (exact.isDelisted === true) {
      return Result.fail(
        delistedError(symbol, internalNameOf(snapshot, exact), [normalized], dexes),
      );
    }
    return Result.succeed(internalNameOf(snapshot, exact));
  }

  const coin = normalized;
  const tried = triedForms(coin, snapshot);
  const matches = snapshot.universe.filter((item) => bareCoinName(item.name) === coin);

  // a. An active main-dex hit keeps its exact name, including today's BTC/ETH
  // behaviour. A delisted main entry is only a fallback: it must not mask a live
  // spot or builder listing that a caller can actually trade.
  const mainMatches = matches.filter((item) => dexNameOf(snapshot, item) === "");
  const activeMain = mainMatches.find((item) => item.isDelisted !== true);
  if (activeMain !== undefined) return Result.succeed(activeMain.name);
  const delistedMain = mainMatches.find((item) => item.isDelisted === true);

  // b. A spot token resolves to the query name of its owning pair.
  const spotPair = snapshot.spotPairs?.find((pair) => normalizeSymbol(pair.token) === coin);
  if (spotPair !== undefined) return Result.succeed(spotPair.queryName);

  // c/d. Builder dexes: a unique hit resolves; several hits never guess.
  const builderMatches = matches.filter((item) => dexNameOf(snapshot, item) !== "");
  const activeBuilders = builderMatches.filter((item) => item.isDelisted !== true);
  if (activeBuilders.length === 1) {
    return Result.succeed(internalNameOf(snapshot, activeBuilders[0]));
  }
  if (activeBuilders.length > 1) {
    return Result.fail(
      ambiguousError(
        symbol,
        activeBuilders.map((item) => internalNameOf(snapshot, item)),
        tried,
        dexes,
      ),
    );
  }

  const delistedBuilder = builderMatches.find((item) => item.isDelisted === true);
  if (delistedBuilder !== undefined) {
    return Result.fail(
      delistedError(symbol, internalNameOf(snapshot, delistedBuilder), tried, dexes),
    );
  }

  // A delisted main listing is the last named reason before a plain miss.
  if (delistedMain !== undefined) {
    return Result.fail(delistedError(symbol, internalNameOf(snapshot, delistedMain), tried, dexes));
  }

  // e. Nothing matched.
  return Result.fail(notFoundError(symbol, tried, dexes));
};
