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
      {/* Stats Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {/* <span className="text-sm font-medium text-foreground/90">Daily Revenue</span> */}
          {/* Parent renders title, we render stats line? 
              User wants:
              Revenue Trend (30d) -- Parent
              Daily Revenue [90d] -- Chart Header Left
              Avg ... Peak ...    -- Chart Header Right
          */}
          <span className="text-xs font-medium text-muted-foreground">Daily Revenue</span>
          <Badge
            variant="secondary"
            className="text-[10px] h-5 rounded-md px-1.5 font-mono text-muted-foreground/70 bg-secondary/50"
          >
            {data.length}d
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono text-muted-foreground/80">
          <div className="flex items-baseline gap-1.5">
            <span className="opacity-70">Avg</span>
            <span className="text-foreground font-medium">${formatCompact(stats.avg)}</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="opacity-70">Peak</span>
            <span className="text-foreground font-medium">${formatCompact(stats.max)}</span>
          </div>
        </div>
      </div>
      <div className="h-56 sm:h-72 w-full">
        <ChartContainer config={chartConfig} className="w-full h-full">
          <AreaChart data={chartData} margin={{ top: 5, right: 0, bottom: 0, left: 0 }}>
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
              tickMargin={12}
              minTickGap={32}
              interval="preserveStartEnd"
              tickFormatter={(value) => value}
              className="text-[10px] font-mono opacity-60"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatCompact(v)}
              tickMargin={4}
              width={35}
              className="text-[10px] font-mono opacity-60"
            />
            <ChartTooltip
              cursor={{ stroke: "var(--color-revenue)", strokeWidth: 1, strokeDasharray: "4 4" }}
              content={
                <ChartTooltipContent
                  indicator="line"
                  labelKey="dateLabel"
                  className="w-[150px] font-mono text-xs"
                  formatter={(value, name) => (
                    <div className="flex min-w-[120px] items-center justify-between text-xs text-muted-foreground">
                      <span className="mr-2">{name}</span>
                      <span className="font-medium text-foreground tabular-nums">
                        ${Number(value).toLocaleString()}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Area
              dataKey="revenue"
              type="step"
              fill="url(#fillRevenue)"
              fillOpacity={0.5}
              stroke="var(--color-revenue)"
              strokeWidth={1.5}
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </div>
    </div>
  );
});
