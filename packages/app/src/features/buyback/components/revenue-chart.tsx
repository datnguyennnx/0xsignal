import { memo, useMemo } from "react";
import { Area, AreaChart, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { DailyRevenuePoint } from "@0xsignal/shared";
import { formatCompact } from "@/core/utils/formatters";
import { Badge } from "@/components/ui/badge";

interface RevenueChartProps {
  readonly data: readonly DailyRevenuePoint[];
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { dateLabel: string } }>;
}) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="bg-background border border-border rounded-lg px-3 py-2 text-xs shadow-sm">
      <div className="text-muted-foreground mb-0.5">{payload[0].payload.dateLabel}</div>
      <div className="font-semibold tabular-nums">${formatCompact(payload[0].value)}</div>
    </div>
  );
}

const MIN_DATA_POINTS = 2;

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

  if (data.length < MIN_DATA_POINTS) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Insufficient revenue history</p>
          <p className="text-xs text-muted-foreground mt-1">
            Need at least {MIN_DATA_POINTS} data points to display chart
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Daily Revenue</span>
          <Badge variant="secondary" className="text-[10px]">
            {data.length}d
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            Avg{" "}
            <span className="text-foreground tabular-nums font-medium">
              ${formatCompact(stats.avg)}
            </span>
          </span>
          <span>
            Peak{" "}
            <span className="text-foreground tabular-nums font-medium">
              ${formatCompact(stats.max)}
            </span>
          </span>
        </div>
      </div>
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
              tickFormatter={(v) => formatCompact(v)}
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
