import { Effect, Layer } from "effect";
import type {
  ClearinghouseState,
  FrontendOpenOrder,
  PortfolioPeriod,
  PortfolioPeriodKey,
  PortfolioResponse,
  UserFill,
  UserVaultEquity,
} from "@0xsignal/shared";
import type {
  ClearinghouseStateInfoResponse,
  FrontendOpenOrdersInfoResponse,
  PortfolioInfoResponse,
  UserFillsInfoResponse,
  UserVaultEquitiesInfoResponse,
} from "@0xsignal/sdk-hyperliquid/info";
import { HyperliquidClient } from "../../integrations/hyperliquid/data-sources/hyperliquid-client";
import { HyperliquidRateLimiter } from "../../integrations/hyperliquid/rate-limit";
import { INFO_WEIGHTS, UNLISTED_INFO_WEIGHT } from "../../integrations/hyperliquid/weights";
import { InternalError } from "../../shared/errors";
import type { AppError } from "../../shared/errors";
import { asRecord, stringAt } from "../../shared/parsing";
import { UserDataService } from "./index";

const callInfoApi = <A>(label: string, fn: () => Promise<A>): Effect.Effect<A, AppError> =>
  Effect.tryPromise({
    try: fn,
    catch: (cause) =>
      new InternalError({
        message: `${label} failed`,
        cause,
      }),
  });

const toClearinghouseState = (state: ClearinghouseStateInfoResponse): ClearinghouseState => ({
  ...state,
  assetPositions: state.assetPositions.map(({ type, position }) => {
    const leverage =
      position.leverage.type === "isolated"
        ? {
            type: "isolated" as const,
            value: position.leverage.value,
            rawUsd: position.leverage.rawUsd,
          }
        : {
            type: "cross" as const,
            value: position.leverage.value,
            rawUsd: position.leverage.rawUsd,
          };
    return { type, position: { ...position, leverage } };
  }),
});

const toFrontendOpenOrders = (orders: FrontendOpenOrdersInfoResponse): FrontendOpenOrder[] =>
  orders.map((order) => ({
    ...order,
    cloid: stringAt(asRecord(order) ?? {}, "cloid") ?? null,
  }));

const toUserFills = (fills: UserFillsInfoResponse): UserFill[] => [...fills];

const PORTFOLIO_PERIODS: readonly PortfolioPeriodKey[] = [
  "day",
  "week",
  "month",
  "allTime",
  "perpDay",
  "perpWeek",
  "perpMonth",
  "perpAllTime",
];

const isPortfolioPeriodKey = (value: unknown): value is PortfolioPeriodKey =>
  typeof value === "string" && PORTFOLIO_PERIODS.some((key) => key === value);

const isHistory = (value: unknown): value is readonly [number, string][] =>
  Array.isArray(value) &&
  value.every(
    (point) =>
      Array.isArray(point) &&
      point.length === 2 &&
      typeof point[0] === "number" &&
      typeof point[1] === "string",
  );

const isPortfolioPeriod = (value: unknown): value is PortfolioPeriod => {
  const record = asRecord(value);
  if (record === null) return false;
  return (
    isHistory(record.accountValueHistory) &&
    isHistory(record.pnlHistory) &&
    typeof record.vlm === "string"
  );
};

const isPortfolioResponse = (value: unknown): value is PortfolioResponse => {
  if (!Array.isArray(value) || value.length !== 8) return false;
  return value.every((entry) => {
    if (!Array.isArray(entry) || entry.length !== 2) return false;
    return isPortfolioPeriodKey(entry[0]) && isPortfolioPeriod(entry[1]);
  });
};

const toPortfolio = (
  portfolio: PortfolioInfoResponse,
): Effect.Effect<PortfolioResponse, AppError> =>
  isPortfolioResponse(portfolio)
    ? Effect.succeed(portfolio)
    : Effect.fail(
        new InternalError({
          message: "portfolio response is not the expected eight-period tuple",
        }),
      );

const toVaultEquities = (equities: UserVaultEquitiesInfoResponse): UserVaultEquity[] => [
  ...equities,
];

export const userDataServiceLayer = Layer.effect(
  UserDataService,
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const limiter = yield* HyperliquidRateLimiter;

    const infoCall = <A>(
      label: string,
      weight: number,
      fn: () => Promise<A>,
    ): Effect.Effect<A, AppError> =>
      limiter.acquire(weight).pipe(
        Effect.mapError(
          (error) =>
            new InternalError({ message: `${label} rate limited: ${error.message}`, cause: error }),
        ),
        Effect.flatMap(() => callInfoApi(label, fn)),
      );

    return UserDataService.of({
      getClearinghouseState: (walletAddress) =>
        infoCall("clearinghouseState", INFO_WEIGHTS.clearinghouseState, () =>
          info.clearinghouseState({ user: walletAddress }),
        ).pipe(Effect.map(toClearinghouseState)),

      getSpotClearinghouseState: (walletAddress) =>
        infoCall("spotClearinghouseState", INFO_WEIGHTS.spotClearinghouseState, () =>
          info.spotClearinghouseState({ user: walletAddress }),
        ),

      getFrontendOpenOrders: (walletAddress) =>
        infoCall("frontendOpenOrders", INFO_WEIGHTS.frontendOpenOrders, () =>
          info.frontendOpenOrders({ user: walletAddress }),
        ).pipe(Effect.map(toFrontendOpenOrders)),

      getHistoricalOrders: (walletAddress) =>
        infoCall("historicalOrders", UNLISTED_INFO_WEIGHT, () =>
          info.historicalOrders({ user: walletAddress }),
        ),

      getUserFills: (walletAddress) =>
        infoCall("userFills", INFO_WEIGHTS.userFills, () =>
          info.userFills({ user: walletAddress }),
        ).pipe(Effect.map(toUserFills)),

      getPortfolio: (walletAddress) =>
        infoCall("portfolio", UNLISTED_INFO_WEIGHT, () =>
          info.portfolio({ user: walletAddress }),
        ).pipe(Effect.flatMap(toPortfolio)),

      // The published table names `vaultEquities`, not `userVaultEquities`;
      // charge the unlisted flat estimate rather than borrow the 20 of another endpoint.
      getUserVaultEquities: (walletAddress) =>
        infoCall("userVaultEquities", UNLISTED_INFO_WEIGHT, () =>
          info.userVaultEquities({ user: walletAddress }),
        ).pipe(Effect.map(toVaultEquities)),

      getUserFunding: (walletAddress, startTime?: number, endTime?: number) =>
        infoCall("userFunding", UNLISTED_INFO_WEIGHT, () =>
          info.userFunding({
            user: walletAddress,
            startTime: startTime ?? 0,
            ...(endTime === undefined ? {} : { endTime }),
          }),
        ),
    });
  }),
);
