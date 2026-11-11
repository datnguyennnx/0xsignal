import { memo, useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { useTrades } from "@/stores/use-market-data-store";
import { ROW_HEIGHT_CLASS } from "../utils/orderbook-utils";
import { TRADE_ROW_CLASS, buildTradeRows } from "../utils/orderbook-trades-view";
import { useOrderbookRows } from "../hooks/use-orderbook-rows";
import { useHyperliquidWs } from "../hooks/use-hyperliquid-ws";
import type { MarketSubscription } from "../lib/market-stream-client";
import { normalizeSymbol } from "../lib/symbol";

function TradeEmptyRow({ heightPx }: { heightPx: number }) {
  return (
    <div
      className={`${ROW_HEIGHT_CLASS} flex items-center justify-center px-2 type-data text-muted-foreground shrink-0`}
      style={{ height: heightPx }}
    >
      No trades yet
    </div>
  );
}

export const OrderbookTrades = memo(function OrderbookTrades({
  symbol,
  displayNSigFigs,
}: {
  symbol: string;
  displayNSigFigs: number;
}) {
  const coin = useMemo(() => normalizeSymbol(symbol), [symbol]);
  const baseSymbol = coin.toUpperCase();
  const trades = useTrades(coin);
  const { bodyRef, rowHeightPx } = useOrderbookRows();

  const subscription = useMemo<MarketSubscription>(
    () => ({ channel: "trades", symbol: coin }),
    [coin],
  );
  useHyperliquidWs({ subscription, enabled: coin !== "" });

  const rows = useMemo(
    () => buildTradeRows(trades ?? [], baseSymbol, displayNSigFigs),
    [trades, baseSymbol, displayNSigFigs],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={`${ROW_HEIGHT_CLASS} flex items-center px-2 type-label uppercase text-muted-foreground shrink-0`}
      >
        <span className="flex-1">Price</span>
        <span className="flex-1 text-right">Size ({baseSymbol})</span>
        <span className="flex-1 text-right">Time</span>
      </div>

      <div ref={bodyRef} className="flex flex-1 min-h-0 flex-col overflow-y-auto">
        {rows.length === 0 ? (
          <TradeEmptyRow heightPx={rowHeightPx} />
        ) : (
          rows.map(({ key, view }) => (
            <div key={key} className={TRADE_ROW_CLASS} style={{ height: rowHeightPx }}>
              <span className={`flex-1 ${view.sideClass}`}>{view.priceText}</span>
              <span className="flex-1 text-right">{view.sizeText}</span>
              <span className="flex flex-1 items-center justify-end gap-1 text-muted-foreground">
                {view.timeText}
                {view.link !== null && (
                  <a
                    href={view.link}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open transaction: ${view.ariaLabel}`}
                    className="focus-ring-inset rounded-sm hover:text-foreground"
                  >
                    <ExternalLink className="size-icon-sm" aria-hidden="true" />
                  </a>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
});
