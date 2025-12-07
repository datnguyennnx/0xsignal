import { memo, useMemo } from "react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import type { DailyRevenuePoint } from "@0xsignal/shared";
import { formatCompact } from "@/core/utils/formatters";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

interface RevenueChartProps {
  readonly data: readonly DailyRevenuePoint[];
}

const MIN_DATA_POINTS = 2;

const chartConfig: ChartConfig = {
  revenue: {
    label: "Daily Revenue",
    color: "hsl(var(--primary))",
  },
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
        <ChartContainer config={chartConfig} className="w-full h-full">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="dateLabel"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              interval="preserveStartEnd"
              tickFormatter={(value) => value}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatCompact(v)}
              tickMargin={4}
              width={40}
            />
            <ChartTooltip content={<ChartTooltipContent indicator="line" labelKey="dateLabel" />} />
            <Area
              dataKey="revenue"
              type="natural"
              fill="url(#fillRevenue)"
              fillOpacity={0.4}
              stroke="var(--color-revenue)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  );
});
