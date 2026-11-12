import { formatPriceWithNSigFigs, formatSize } from "@/core/utils/formatters";
import { type TradeTick } from "../lib/trade-tick";
import { ROW_HEIGHT_CLASS } from "./orderbook-utils";

const tradeSideClass = (side: "buy" | "sell"): string =>
  side === "buy" ? "text-data-up" : "text-data-down";

export const TRADE_ROW_CLASS = `${ROW_HEIGHT_CLASS} flex items-center px-2 gap-1 type-data tabular-nums shrink-0`;

const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function exchangeTxUrl(hash: string): string {
  return `https://app.hyperliquid.xyz/explorer/tx/${hash}`;
}

interface TradeRowView {
  readonly price: number;
  readonly priceText: string;
  readonly sizeText: string;
  readonly timeText: string;
  readonly side: "buy" | "sell";
  readonly sideClass: string;
  readonly link: string | null;
  readonly ariaLabel: string;
}

interface TradeRow {
  readonly key: string;
  readonly view: TradeRowView;
}

export function tradeRowView(tick: TradeTick, baseSymbol: string, nSigFigs: number): TradeRowView {
  const priceText = formatPriceWithNSigFigs(tick.px, nSigFigs);
  const sizeText = formatSize(tick.sz);
  const timeText = TIME_FORMATTER.format(tick.time);
  const sideName = tick.side === "buy" ? "Buy" : "Sell";

  return {
    price: tick.px,
    priceText,
    sizeText,
    timeText,
    side: tick.side,
    sideClass: tradeSideClass(tick.side),
    link: tick.hash === null ? null : exchangeTxUrl(tick.hash),
    ariaLabel: `${sideName} ${sizeText} ${baseSymbol} at ${priceText}, ${timeText}`,
  };
}

export function buildTradeRows(
  ticks: readonly TradeTick[],
  baseSymbol: string,
  nSigFigs: number,
): readonly TradeRow[] {
  const occurrences = new Map<string, number>();

  return ticks.map((tick) => {
    const identity =
      tick.tid === null ? `${tick.time}-${tick.px}-${tick.sz}-${tick.side}` : `tid:${tick.tid}`;
    const seen = occurrences.get(identity) ?? 0;
    occurrences.set(identity, seen + 1);

    return {
      key: seen === 0 ? identity : `${identity}#${seen}`,
      view: tradeRowView(tick, baseSymbol, nSigFigs),
    };
  });
}
