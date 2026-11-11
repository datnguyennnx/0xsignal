/**
 * @hyperliquid-api POST /info
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint.md
 */

import type { Address, DecimalString } from "../../core/brands";
import type { CandleInterval } from "../../core/intervals";

import type { ClearinghouseState } from "./perp";

export type { ClearinghouseState };

export type OrderLifecycleStatus =
  | "open"
  | "filled"
  | "canceled"
  | "triggered"
  | "rejected"
  | "marginCanceled"
  | "vaultWithdrawalCanceled"
  | "openInterestCapCanceled"
  | "selfTradeCanceled"
  | "reduceOnlyCanceled"
  | "siblingFilledCanceled"
  | "delistedCanceled"
  | "liquidatedCanceled"
  | "scheduledCancel"
  | "tickRejected"
  | "minTradeNtlRejected"
  | "perpMarginRejected"
  | "reduceOnlyRejected"
  | "badAloPxRejected"
  | "iocCancelRejected"
  | "badTriggerPxRejected"
  | "marketOrderNoLiquidityRejected"
  | "positionIncreaseAtOpenInterestCapRejected"
  | "positionFlipAtOpenInterestCapRejected"
  | "tooAggressiveAtOpenInterestCapRejected"
  | "openInterestIncreaseRejected"
  | "insufficientSpotBalanceRejected"
  | "oracleRejected"
  | "perpMaxPositionRejected";

export type { CandleInterval } from "../../core/intervals";

export type PortfolioPeriod =
  | "day"
  | "week"
  | "month"
  | "allTime"
  | "perpDay"
  | "perpWeek"
  | "perpMonth"
  | "perpAllTime";

type Order = {
  coin: string;
  side: "A" | "B";
  limitPx: DecimalString;
  sz: DecimalString;
  oid: number;
  timestamp: number;
  triggerCondition: string;
  isTrigger: boolean;
  triggerPx: DecimalString;
  children: readonly unknown[];
  isPositionTpsl: boolean;
  reduceOnly: boolean;
  orderType: string;
  origSz: DecimalString;
  tif: string;
  cloid: string | null;
};

type Fill = {
  closedPnl: DecimalString;
  coin: string;
  crossed: boolean;
  dir: string;
  hash: string;
  oid: number;
  px: DecimalString;
  side: "A" | "B";
  startPosition: DecimalString;
  sz: DecimalString;
  time: number;
  fee: DecimalString;
  feeToken: string;
  builderFee?: DecimalString;
  tid: number;
};

type TwapFill = Omit<Fill, "builderFee">;

type Portfolio = ReadonlyArray<
  readonly [
    PortfolioPeriod,
    {
      accountValueHistory: ReadonlyArray<readonly [number, DecimalString]>;
      pnlHistory: ReadonlyArray<readonly [number, DecimalString]>;
      vlm: DecimalString;
    },
  ]
>;

type L2Level = { px: DecimalString; sz: DecimalString; n: number };

export type AllMidsInfoRequest = { type: "allMids"; dex?: string };
export type AllMidsInfoResponse = Record<string, DecimalString>;

export type OpenOrdersInfoRequest = { type: "openOrders"; user: string; dex?: string };
export type OpenOrdersInfoResponse = ReadonlyArray<{
  coin: string;
  limitPx: DecimalString;
  oid: number;
  side: "A" | "B";
  sz: DecimalString;
  timestamp: number;
}>;

export type FrontendOpenOrdersInfoRequest = {
  type: "frontendOpenOrders";
  user: string;
  dex?: string;
};
export type FrontendOpenOrdersInfoResponse = ReadonlyArray<{
  coin: string;
  isPositionTpsl: boolean;
  isTrigger: boolean;
  limitPx: DecimalString;
  oid: number;
  orderType: string;
  origSz: DecimalString;
  reduceOnly: boolean;
  side: "A" | "B";
  sz: DecimalString;
  timestamp: number;
  triggerCondition: string;
  triggerPx: DecimalString;
}>;

export type UserFillsInfoRequest = { type: "userFills"; user: string; aggregateByTime?: boolean };
export type UserFillsInfoResponse = ReadonlyArray<Fill>;

export type UserFillsByTimeInfoRequest = {
  type: "userFillsByTime";
  user: string;
  startTime: number;
  endTime?: number;
  aggregateByTime?: boolean;
};
export type UserFillsByTimeInfoResponse = ReadonlyArray<Fill>;

export type UserRateLimitInfoRequest = { type: "userRateLimit"; user: string };
export type UserRateLimitInfoResponse = {
  cumVlm: DecimalString;
  nRequestsUsed: number;
  nRequestsCap: number;
  nRequestsSurplus: number;
};

export type OrderStatusInfoRequest = { type: "orderStatus"; user: string; oid: number | string };
export type OrderStatusInfoResponse =
  | {
      status: "order";
      order: {
        order: Order;
        status: OrderLifecycleStatus;
        statusTimestamp: number;
      };
    }
  | { status: "unknownOid" };

export type L2BookInfoRequest =
  | {
      type: "l2Book";
      coin: string;
      nSigFigs?: 2 | 3 | 4 | 5 | null;
    }
  | {
      type: "l2Book";
      coin: string;
      nSigFigs: 5;
      mantissa: 1 | 2 | 5;
    };
export type L2BookInfoResponse = {
  coin: string;
  time: number;
  levels: readonly [ReadonlyArray<L2Level>, ReadonlyArray<L2Level>];
};

export type CandleSnapshotInfoRequest = {
  type: "candleSnapshot";
  req: { coin: string; interval: CandleInterval; startTime: number; endTime: number };
};
export type CandleSnapshotInfoResponse = ReadonlyArray<{
  T: number;
  c: DecimalString;
  h: DecimalString;
  i: CandleInterval;
  l: DecimalString;
  n: number;
  o: DecimalString;
  s: string;
  t: number;
  v: DecimalString;
}>;

export type MaxBuilderFeeInfoRequest = { type: "maxBuilderFee"; user: string; builder: string };
export type MaxBuilderFeeInfoResponse = number;

export type HistoricalOrdersInfoRequest = { type: "historicalOrders"; user: string };
export type HistoricalOrdersInfoResponse = ReadonlyArray<{
  order: Order;
  status: string;
  statusTimestamp: number;
}>;

export type UserTwapSliceFillsInfoRequest = { type: "userTwapSliceFills"; user: string };
export type UserTwapSliceFillsInfoResponse = ReadonlyArray<{ fill: TwapFill; twapId: number }>;

export type SubAccountsInfoRequest = { type: "subAccounts"; user: string };
export type SubAccountsInfoResponse = ReadonlyArray<{
  name: string;
  subAccountUser: string;
  master: string;
  clearinghouseState: ClearinghouseState;
  spotState: {
    balances: ReadonlyArray<{
      coin: string;
      token: number;
      total: DecimalString;
      hold: DecimalString;
      entryNtl: DecimalString;
    }>;
  };
}>;

export type VaultDetailsInfoRequest = { type: "vaultDetails"; vaultAddress: string; user?: string };
export type VaultDetailsInfoResponse = {
  name: string;
  vaultAddress: string;
  leader: string;
  description: string;
  portfolio: Portfolio;
  apr: number;
  followerState: unknown;
  leaderFraction: number;
  leaderCommission: number;
  followers: ReadonlyArray<{
    user: string;
    vaultEquity: DecimalString;
    pnl: DecimalString;
    allTimePnl: DecimalString;
    daysFollowing: number;
    vaultEntryTime: number;
    lockupUntil: number;
  }>;
  maxDistributable: number;
  maxWithdrawable: number;
  isClosed: boolean;
  relationship: { type: string; data: { childAddresses: ReadonlyArray<string> } } | null;
  allowDeposits: boolean;
  alwaysCloseOnWithdraw: boolean;
};

export type UserVaultEquitiesInfoRequest = { type: "userVaultEquities"; user: string };
export type UserVaultEquitiesInfoResponse = ReadonlyArray<{
  vaultAddress: string;
  equity: DecimalString;
}>;

export type UserRoleInfoRequest = { type: "userRole"; user: string };
export type UserRoleInfoResponse =
  | { role: "missing" | "user" | "vault" }
  | { role: "agent"; data: { user: string } }
  | { role: "subAccount"; data: { master: string } };

export type PortfolioInfoRequest = { type: "portfolio"; user: string };
export type PortfolioInfoResponse = Portfolio;

export type ReferralInfoRequest = { type: "referral"; user: string };
export type ReferralInfoResponse = {
  referredBy: { referrer: string; code: string } | null;
  cumVlm: DecimalString;
  unclaimedRewards: DecimalString;
  claimedRewards: DecimalString;
  builderRewards: DecimalString;
  tokenToState: ReadonlyArray<
    readonly [
      number,
      {
        cumVlm: DecimalString;
        unclaimedRewards: DecimalString;
        claimedRewards: DecimalString;
        builderRewards: DecimalString;
      },
    ]
  >;
  referrerState: {
    stage: string;
    data: {
      code: string;
      referralStates: ReadonlyArray<{
        cumVlm: DecimalString;
        cumRewardedFeesSinceReferred: DecimalString;
        cumFeesRewardedToReferrer: DecimalString;
        timeJoined: number;
        user: string;
      }>;
    };
  };
  rewardHistory: readonly unknown[];
};

export type UserFeesInfoRequest = { type: "userFees"; user: string };
export type UserFeesInfoResponse = {
  dailyUserVlm: ReadonlyArray<{
    date: string;
    userCross: DecimalString;
    userAdd: DecimalString;
    exchange: DecimalString;
  }>;
  feeSchedule: {
    cross: DecimalString;
    add: DecimalString;
    spotCross: DecimalString;
    spotAdd: DecimalString;
    tiers: {
      vip: ReadonlyArray<{
        ntlCutoff: DecimalString;
        cross: DecimalString;
        add: DecimalString;
        spotCross: DecimalString;
        spotAdd: DecimalString;
      }>;
      mm: ReadonlyArray<{ makerFractionCutoff: DecimalString; add: DecimalString }>;
    };
    referralDiscount: DecimalString;
    stakingDiscountTiers: ReadonlyArray<{ bpsOfMaxSupply: DecimalString; discount: DecimalString }>;
  };
  userCrossRate: DecimalString;
  userAddRate: DecimalString;
  userSpotCrossRate: DecimalString;
  userSpotAddRate: DecimalString;
  activeReferralDiscount: DecimalString;
  trial: unknown;
  feeTrialReward: DecimalString;
  nextTrialAvailableTimestamp: number | null;
  stakingLink: { type: string; stakingUser: string } | null;
  activeStakingDiscount: { bpsOfMaxSupply: DecimalString; discount: DecimalString } | null;
};

export type DelegationsInfoRequest = { type: "delegations"; user: string };
export type DelegationsInfoResponse = ReadonlyArray<{
  validator: string;
  amount: DecimalString;
  lockedUntilTimestamp: number;
}>;

export type DelegatorSummaryInfoRequest = { type: "delegatorSummary"; user: string };
export type DelegatorSummaryInfoResponse = {
  delegated: DecimalString;
  undelegated: DecimalString;
  totalPendingWithdrawal: DecimalString;
  nPendingWithdrawals: number;
};

export type DelegatorHistoryInfoRequest = { type: "delegatorHistory"; user: string };
export type DelegatorHistoryInfoResponse = ReadonlyArray<{
  time: number;
  hash: string;
  delta: { delegate: { validator: string; amount: DecimalString; isUndelegate: boolean } };
}>;

export type DelegatorRewardsInfoRequest = { type: "delegatorRewards"; user: string };
export type DelegatorRewardsInfoResponse = ReadonlyArray<{
  time: number;
  source: "delegation" | "commission";
  totalAmount: DecimalString;
}>;

export type UserDexAbstractionInfoRequest = { type: "userDexAbstraction"; user: string };
export type UserDexAbstractionInfoResponse = boolean;

export type UserAbstractionInfoRequest = { type: "userAbstraction"; user: string };
export type UserAbstractionInfoResponse =
  | "unifiedAccount"
  | "portfolioMargin"
  | "disabled"
  | "default"
  | "dexAbstraction";

export type BorrowLendUserStateInfoRequest = { type: "borrowLendUserState"; user: string };
export type BorrowLendUserStateInfoResponse = {
  tokenToState: ReadonlyArray<
    readonly [
      number,
      {
        borrow: { basis: DecimalString; value: DecimalString };
        supply: { basis: DecimalString; value: DecimalString };
      },
    ]
  >;
};

export type BorrowLendReserveStateInfoRequest = { type: "borrowLendReserveState"; token: number };
export type BorrowLendReserveStateInfoResponse = unknown;

export type AllBorrowLendReserveStatesInfoRequest = { type: "allBorrowLendReserveStates" };
export type AllBorrowLendReserveStatesInfoResponse = unknown;

export type ApprovedBuildersInfoRequest = { type: "approvedBuilders"; user: string };
export type ApprovedBuildersInfoResponse = ReadonlyArray<Address>;

export type MainInfoRequest =
  | AllMidsInfoRequest
  | OpenOrdersInfoRequest
  | FrontendOpenOrdersInfoRequest
  | UserFillsInfoRequest
  | UserFillsByTimeInfoRequest
  | UserRateLimitInfoRequest
  | OrderStatusInfoRequest
  | L2BookInfoRequest
  | CandleSnapshotInfoRequest
  | MaxBuilderFeeInfoRequest
  | HistoricalOrdersInfoRequest
  | UserTwapSliceFillsInfoRequest
  | SubAccountsInfoRequest
  | VaultDetailsInfoRequest
  | UserVaultEquitiesInfoRequest
  | UserRoleInfoRequest
  | PortfolioInfoRequest
  | ReferralInfoRequest
  | UserFeesInfoRequest
  | DelegationsInfoRequest
  | DelegatorSummaryInfoRequest
  | DelegatorHistoryInfoRequest
  | DelegatorRewardsInfoRequest
  | UserDexAbstractionInfoRequest
  | UserAbstractionInfoRequest
  | BorrowLendUserStateInfoRequest
  | BorrowLendReserveStateInfoRequest
  | AllBorrowLendReserveStatesInfoRequest
  | ApprovedBuildersInfoRequest;

export type MainInfoResponse =
  | AllMidsInfoResponse
  | OpenOrdersInfoResponse
  | FrontendOpenOrdersInfoResponse
  | UserFillsInfoResponse
  | UserFillsByTimeInfoResponse
  | UserRateLimitInfoResponse
  | OrderStatusInfoResponse
  | L2BookInfoResponse
  | CandleSnapshotInfoResponse
  | MaxBuilderFeeInfoResponse
  | HistoricalOrdersInfoResponse
  | UserTwapSliceFillsInfoResponse
  | SubAccountsInfoResponse
  | VaultDetailsInfoResponse
  | UserVaultEquitiesInfoResponse
  | UserRoleInfoResponse
  | PortfolioInfoResponse
  | ReferralInfoResponse
  | UserFeesInfoResponse
  | DelegationsInfoResponse
  | DelegatorSummaryInfoResponse
  | DelegatorHistoryInfoResponse
  | DelegatorRewardsInfoResponse
  | UserDexAbstractionInfoResponse
  | UserAbstractionInfoResponse
  | BorrowLendUserStateInfoResponse
  | ApprovedBuildersInfoResponse;
