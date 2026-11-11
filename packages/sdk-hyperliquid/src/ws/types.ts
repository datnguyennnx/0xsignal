/**
 * @hyperliquid-api wss://api.hyperliquid.xyz/ws
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket/subscriptions.md
 */

import type { DecimalString } from "../core/brands";
import type { CandleInterval } from "../core/intervals";
import type {
  ActiveAssetDataInfoResponse,
  ClearinghouseState,
  SpotBalance,
  UserNonFundingLedgerUpdatesInfoResponse,
  UserTwapSliceFillsInfoResponse,
} from "../info/types";

export type { CandleInterval } from "../core/intervals";

export type AllMidsSubscription = { type: "allMids"; dex?: string };
export type NotificationSubscription = { type: "notification"; user: string };
export type WebData3Subscription = { type: "webData3"; user: string };
export type TwapStatesSubscription = { type: "twapStates"; user: string; dex: string };
export type ClearinghouseStateSubscription = {
  type: "clearinghouseState";
  user: string;
  dex: string;
};
export type OpenOrdersSubscription = { type: "openOrders"; user: string; dex: string };
export type CandleSubscription = { type: "candle"; coin: string; interval: CandleInterval };
export type L2BookSubscription = {
  type: "l2Book";
  coin: string;
  nSigFigs?: 2 | 3 | 4 | 5 | null;
  mantissa?: 1 | 2 | 5;
  fast?: boolean;
};
export type TradesSubscription = { type: "trades"; coin: string };
export type OrderUpdatesSubscription = { type: "orderUpdates"; user: string };
export type UserEventsSubscription = { type: "userEvents"; user: string };
export type UserFillsSubscription = {
  type: "userFills";
  user: string;
  aggregateByTime?: boolean;
};
export type UserFundingsSubscription = { type: "userFundings"; user: string };
export type UserNonFundingLedgerUpdatesSubscription = {
  type: "userNonFundingLedgerUpdates";
  user: string;
};
export type ActiveAssetCtxSubscription = { type: "activeAssetCtx"; coin: string };
export type ActiveAssetDataSubscription = { type: "activeAssetData"; user: string; coin: string };
export type UserTwapSliceFillsSubscription = { type: "userTwapSliceFills"; user: string };
export type UserTwapHistorySubscription = { type: "userTwapHistory"; user: string };
export type BboSubscription = { type: "bbo"; coin: string };
export type SpotStateSubscription = {
  type: "spotState";
  user: string;
  isPortfolioMargin?: boolean;
};
export type AllDexsClearinghouseStateSubscription = {
  type: "allDexsClearinghouseState";
  user: string;
};
export type AllDexsAssetCtxsSubscription = { type: "allDexsAssetCtxs" };
export type OutcomeMetaUpdatesSubscription = { type: "outcomeMetaUpdates" };
export type FastAssetCtxsSubscription = { type: "fastAssetCtxs" };

export type Subscription =
  | AllMidsSubscription
  | NotificationSubscription
  | WebData3Subscription
  | TwapStatesSubscription
  | ClearinghouseStateSubscription
  | OpenOrdersSubscription
  | CandleSubscription
  | L2BookSubscription
  | TradesSubscription
  | OrderUpdatesSubscription
  | UserEventsSubscription
  | UserFillsSubscription
  | UserFundingsSubscription
  | UserNonFundingLedgerUpdatesSubscription
  | ActiveAssetCtxSubscription
  | ActiveAssetDataSubscription
  | UserTwapSliceFillsSubscription
  | UserTwapHistorySubscription
  | BboSubscription
  | SpotStateSubscription
  | AllDexsClearinghouseStateSubscription
  | AllDexsAssetCtxsSubscription
  | OutcomeMetaUpdatesSubscription
  | FastAssetCtxsSubscription;

export type WsFrame<T> = { channel: string; data: T };

export type SubscriptionResponse = {
  channel: "subscriptionResponse";
  data: { method: "subscribe" | "unsubscribe"; subscription: Subscription };
};

export type PongFrame = { channel: "pong" };

export type ErrorFrame = { channel: "error"; data: string };

export type PostFrame = {
  channel: "post";
  data: {
    id: number;
    response: { type: "info" | "action" | "error"; payload: unknown };
  };
};

export type WsLevel = { px: DecimalString; sz: DecimalString; n: number };

export type WsBook = {
  coin: string;
  levels: [WsLevel[], WsLevel[]];
  time: number;
};

export type WsBbo = {
  coin: string;
  bbo: [WsLevel | null, WsLevel | null];
  time: number;
};

export type WsNotification = {
  notification: {
    type: string;
    [field: string]: unknown;
  };
};

export type WsFill = {
  coin: string;
  px: DecimalString;
  sz: DecimalString;
  side: "A" | "B";
  time: number;
  startPosition: DecimalString;
  dir: string;
  closedPnl: DecimalString;
  hash: string;
  oid: number;
  crossed: boolean;
  fee: DecimalString;
  feeToken: string;
  tid: number;
  builderFee?: DecimalString;
  liquidation?: {
    liquidatedUser?: string;
    markPx: DecimalString;
    method: "market" | "backstop";
  };
};

export type WsUserFills = {
  isSnapshot?: boolean;
  user: string;
  fills: WsFill[];
};

export type WsUserFundings = {
  isSnapshot?: boolean;
  user: string;
  fundings: {
    time: number;
    coin: string;
    usdc: DecimalString;
    szi: DecimalString;
    fundingRate: DecimalString;
  }[];
};

export type WsTrade = {
  coin: string;
  side: "A" | "B";
  px: DecimalString;
  sz: DecimalString;
  hash: string;
  time: number;
  tid: number;
  users: readonly [string, string];
};

export type WsOrder = {
  order: {
    coin: string;
    side: "A" | "B";
    limitPx: DecimalString;
    sz: DecimalString;
    oid: number;
    timestamp: number;
    origSz: DecimalString;
    cloid?: string;
  };
  status: string;
  statusTimestamp: number;
};

export type WsCandle = {
  t: number;
  T: number;
  s: string;
  i: string;
  o: number;
  c: number;
  h: number;
  l: number;
  v: number;
  n: number;
};

export type WsActiveAssetCtx = {
  coin: string;
  ctx: {
    dayNtlVlm: DecimalString;
    prevDayPx: DecimalString;
    markPx: DecimalString;
    midPx?: DecimalString;
    funding: DecimalString;
    openInterest: DecimalString;
    oraclePx: DecimalString;
    circulatingSupply?: DecimalString;
  };
};

export type WsTwapState = {
  coin: string;
  user: string;
  side: "A" | "B";
  sz: DecimalString;
  executedSz: DecimalString;
  executedNtl: DecimalString;
  minutes: number;
  reduceOnly: boolean;
  randomize: boolean;
  timestamp: number;
};

export type UserEvent =
  | { fills: readonly WsFill[] }
  | {
      funding: {
        time: number;
        coin: string;
        usdc: DecimalString;
        szi: DecimalString;
        fundingRate: DecimalString;
      };
    }
  | {
      liquidation: {
        liqValue: DecimalString;
        leverageType: "Cross" | "Isolated";
        liquidatedPositions: readonly { coin: string; szi: DecimalString }[];
      };
    }
  | { nonUserCancel: readonly { coin: string; oid: number }[] };

export type SubscriptionPayload = {
  allMids: { mids: Record<string, DecimalString> };
  l2Book: WsBook;
  trades: readonly WsTrade[];
  candle: readonly WsCandle[];
  userFills: WsUserFills;
  userFundings: WsUserFundings;
  orderUpdates: readonly WsOrder[];
  bbo: WsBbo;
  notification: WsNotification;
  spotState: { user: string; spotState: { balances: readonly SpotBalance[] } };
  clearinghouseState: { dex: string; user: string; clearinghouseState: ClearinghouseState };
  openOrders: { dex: string; user: string; orders: readonly WsOrder["order"][] };
  activeAssetCtx: WsActiveAssetCtx;
  userTwapSliceFills: UserTwapSliceFillsInfoResponse;
  userTwapHistory: {
    user: string;
    history: readonly {
      state: WsTwapState;
      status: { status: string; description: string };
      time: number;
    }[];
  };
  userEvents: UserEvent;
  userNonFundingLedgerUpdates: UserNonFundingLedgerUpdatesInfoResponse;
  activeAssetData: ActiveAssetDataInfoResponse;
  webData3: { userState: unknown; perpDexStates: readonly unknown[] };
  allDexsClearinghouseState: {
    user: string;
    clearinghouseStates: readonly (readonly [string, unknown])[];
  };
  allDexsAssetCtxs: { ctxs: readonly (readonly [string, readonly unknown[]])[] };
  outcomeMetaUpdates: readonly unknown[];
  fastAssetCtxs: Record<string, { markPx?: number; midPx?: number | null }>;
  twapStates: unknown;
};

export type PayloadOf<S extends Subscription> = SubscriptionPayload[S["type"]];
