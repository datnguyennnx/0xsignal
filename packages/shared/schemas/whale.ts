export type WhaleSide = "buy" | "sell";

export type WhalePositionSort = "notional" | "pnl" | "funding";

export const WHALE_POSITIONS_LIMIT_DEFAULT = 50;
export const WHALE_POSITIONS_LIMIT_MIN = 1;
export const WHALE_POSITIONS_LIMIT_MAX = 200;

export interface WhalePosition {
  userAddress: string;
  coin: string;
  side: WhaleSide;
  size: number;
  notionalUsd: number;
  entryPx: string;
  liquidationPx?: string | undefined;
  leverage?: number | undefined;
  leverageType?: "cross" | "isolated" | undefined;
  marginUsd?: number | undefined;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  fundingFee?: number | undefined;
  markPrice?: string | undefined;
  entryTime: string;
}

export interface WhalePositionsQuery {
  symbol?: string | undefined;
  side?: WhaleSide | undefined;
  pnlMin?: number;
  pnlMax?: number;
  fundingMin?: number;
  sort?: WhalePositionSort;
  limit?: number;
  cursor?: string | undefined;
}

export interface WhaleLeaderboardRow {
  ethAddress: string;
  accountValue: number;
}

export interface WhalePositionsApiResponse {
  positions: WhalePosition[];
  nextCursor?: string | null;
  fetchedAt: string;
}

export interface WhaleTrade {
  tid: string;
  user: string;
  coin: string;
  side: WhaleSide;
  px: string;
  sz: string;
  notionalUsd: number;
  time: string;
}
