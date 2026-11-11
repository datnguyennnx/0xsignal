import type { WsTrade } from "@0xsignal/sdk-hyperliquid/subscription";

export type TradeTick = {
  readonly px: number;
  readonly sz: number;
  readonly time: number;
  readonly side: "buy" | "sell";
  readonly hash: string | null;
  readonly tid: number | null;
};

export const MAX_TRADE_TICKS = 50;

export const isTradeBatch = (value: unknown): value is readonly WsTrade[] => Array.isArray(value);

export function toTradeTicks(raw: readonly WsTrade[]): readonly TradeTick[] {
  const ticks: TradeTick[] = [];
  for (const trade of raw) {
    const px = Number(trade.px);
    const sz = Number(trade.sz);
    if (!Number.isFinite(px) || !Number.isFinite(sz)) continue;
    ticks.push({
      px,
      sz,
      time: trade.time,
      side: trade.side === "B" ? "buy" : "sell",
      hash: typeof trade.hash === "string" && trade.hash !== "" ? trade.hash : null,
      tid: typeof trade.tid === "number" && Number.isFinite(trade.tid) ? trade.tid : null,
    });
  }
  return ticks;
}
