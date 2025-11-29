/**
 * Mini Sparkline - Small area chart for trade setup cards
 * Fetches 7-day hourly data and displays as a simple line
 */

import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cachedChartData } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { cn } from "@/core/utils/cn";

interface MiniSparklineProps {
  symbol: string;
  isPositive: boolean;
  className?: string;
}

export function MiniSparkline({ symbol, isPositive, className }: MiniSparklineProps) {
  const binanceSymbol = `${symbol.toUpperCase()}USDT`;

  const { data: chartData, isLoading } = useEffectQuery(
    () => cachedChartData(binanceSymbol, "1h", "7d"),
    [binanceSymbol]
  );

  // Transform data for recharts - just need close prices
  const sparklineData = useMemo(() => {
    if (!chartData?.length) return [];
    // Sample every 4th point to reduce data points (168 -> ~42 points)
    return chartData
      .filter((_, i) => i % 4 === 0)
      .map((point) => ({
        value: point.close,
      }));
  }, [chartData]);

  if (isLoading || sparklineData.length < 2) {
    return <div className={cn("h-10 w-full bg-muted/30 rounded animate-pulse", className)} />;
  }

  const strokeColor = isPositive ? "var(--gain)" : "var(--loss)";
  const fillColor = isPositive ? "var(--gain)" : "var(--loss)";

  return (
    <div className={cn("h-10 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sparklineData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity={0.2} />
              <stop offset="100%" stopColor={fillColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={1.5}
            fill={`url(#gradient-${symbol})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
