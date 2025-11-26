import { memo, useMemo } from "react";
import { Area, AreaChart, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { DailyRevenuePoint } from "@0xsignal/shared";

interface RevenueChartProps {
  readonly data: readonly DailyRevenuePoint[];
}

const formatCurrency = (value: number): string => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatYAxis = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return `${value}`;
};

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { dateLabel: string } }>;
}) => {
  if (!active || !payload?.[0]) return null;

  return (
    <div className="bg-background border border-border rounded px-2 py-1.5 text-xs shadow-sm">
      <div className="text-muted-foreground">{payload[0].payload.dateLabel}</div>
      <div className="font-medium tabular-nums">{formatCurrency(payload[0].value)}</div>
    </div>
  );
};

export const RevenueChart = memo(function RevenueChart({ data }: RevenueChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => {
      const date = new Date(d.date * 1000);
      return {
        date: d.date,
        dateLabel: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        revenue: d.revenue,
      };
    });
  }, [data]);

  const stats = useMemo(() => {
    if (data.length === 0) return { max: 0, avg: 0 };
    const values = data.map((d) => d.revenue);
    const max = Math.max(...values);
    const total = values.reduce((a, b) => a + b, 0);
    return { max, avg: total / values.length };
  }, [data]);

  if (data.length < 2) {
    return (
      <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">
        Insufficient data
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Daily Revenue (90d)</span>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span>
            Avg <span className="text-foreground tabular-nums">{formatCurrency(stats.avg)}</span>
          </span>
          <span>
            Max <span className="text-foreground tabular-nums">{formatCurrency(stats.max)}</span>
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-56 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity={0.15} />
                <stop offset="100%" stopColor="currentColor" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="dateLabel"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickMargin={8}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={formatYAxis}
              tickMargin={4}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--border))" }} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="currentColor"
              strokeWidth={1.5}
              fill="url(#revenueGradient)"
              className="text-foreground"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});
