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

const SAMPLE_INTERVAL = 4;

export function MiniSparkline({ symbol, isPositive, className }: MiniSparklineProps) {
  const binanceSymbol = `${symbol.toUpperCase()}USDT`;

  const { data: chartData, isLoading } = useEffectQuery(
    () => cachedChartData(binanceSymbol, "1h", "7d"),
    [binanceSymbol]
  );

  const sparklineData = useMemo(() => {
    if (!chartData?.length) return [];
    return chartData
      .filter((_, i) => i % SAMPLE_INTERVAL === 0)
      .map((point) => ({ value: point.close }));
  }, [chartData]);

  if (isLoading || sparklineData.length < 2) {
    return <div className={cn("h-10 w-full bg-muted/30 rounded animate-pulse", className)} />;
  }

  const color = isPositive ? "var(--gain)" : "var(--loss)";

  return (
    <div className={cn("h-10 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={sparklineData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.2} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#gradient-${symbol})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
