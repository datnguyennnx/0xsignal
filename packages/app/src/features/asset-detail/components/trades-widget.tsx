import { memo } from "react";
import { useHyperliquidTrades, type Trade } from "@/hooks/use-hyperliquid-trades";
import { formatPrice } from "@/core/utils/formatters";
import { cn } from "@/core/utils/cn";
import { Activity } from "lucide-react";
import { format } from "date-fns";

interface TradesWidgetProps {
  symbol: string;
}

const TradeRow = memo(
  ({ trade }: { trade: Trade }) => {
    return (
      <div
        className={cn(
          "grid grid-cols-3 items-center px-3 h-6 text-xs font-mono border-b border-border/5 last:border-0 cursor-default",
          trade.isLiquidation ? "bg-orange-500/10" : "hover:bg-muted/30"
        )}
      >
        <span className="text-muted-foreground text-left tabular-nums">
          {format(trade.time, "HH:mm:ss")}
        </span>
        <span
          className={cn(
            "font-medium text-right tabular-nums",
            trade.side === "buy" ? "text-gain" : "text-loss",
            trade.isLiquidation && "font-bold"
          )}
        >
          {formatPrice(trade.price)}
        </span>
        <span
          className={cn(
            "text-right tabular-nums",
            trade.isLiquidation ? "text-orange-500 font-bold" : "text-muted-foreground"
          )}
        >
          {trade.size.toFixed(trade.size < 1 ? 4 : 2)}
          {trade.isLiquidation && (
            <span className="ml-1 text-[9px] uppercase tracking-wide">Liq</span>
          )}
        </span>
      </div>
    );
  },
  (prev, next) => prev.trade.id === next.trade.id
);

export const TradesWidget = memo(
  function TradesWidget({ symbol }: TradesWidgetProps) {
    const { trades, isConnected } = useHyperliquidTrades(symbol);

    if (!isConnected) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
          <Activity className="w-4 h-4 animate-spin" />
          <span className="text-[10px] uppercase tracking-wider">Connecting...</span>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col bg-card border rounded-lg overflow-hidden p-2">
        {/* Header */}
        <div className="grid grid-cols-3 items-center px-3 py-2 border-b border-border/20 text-[10px] text-muted-foreground font-mono uppercase tracking-wider bg-muted/20 shrink-0">
          <span className="text-left">Time</span>
          <span className="text-right">Price</span>
          <span className="text-right">Amount</span>
        </div>

        {/* Trades List */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          {trades.map((trade) => (
            <TradeRow key={trade.id} trade={trade} />
          ))}
        </div>
      </div>
    );
  },
  (prev, next) => prev.symbol === next.symbol
);
