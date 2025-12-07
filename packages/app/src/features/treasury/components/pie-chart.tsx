import { Pie, PieChart as RechartsPieChart, Cell, Tooltip } from "recharts";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { formatCompact } from "@/core/utils/formatters";
import type { CoinHolding } from "@0xsignal/shared";

/** Pie chart colors - monochrome with one accent */
const CHART_COLORS = [
  "oklch(0.45 0 0)", // BTC - Dark gray
  "oklch(0.65 0 0)", // ETH - Medium gray
  "oklch(0.80 0 0)", // Others - Light gray
];

/** Simple pie chart component using Recharts */
export function PieChart({ holdings }: { holdings: readonly CoinHolding[] }) {
  const total = holdings.reduce((acc, h) => acc + h.valueUsd, 0);
  if (total === 0) return null;

  // Prepare chart data and config
  const chartData = holdings.map((h, i) => ({
    symbol: h.coinSymbol,
    value: h.valueUsd,
    fill: CHART_COLORS[i % CHART_COLORS.length],
    percentage: (h.valueUsd / total) * 100,
  }));

  const chartConfig = holdings.reduce((acc, h, i) => {
    acc[h.coinSymbol] = {
      label: h.coinSymbol,
      color: CHART_COLORS[i % CHART_COLORS.length],
    };
    return acc;
  }, {} as ChartConfig);

  return (
    <div className="flex items-center gap-4">
      {/* Pie Chart */}
      <ChartContainer config={chartConfig} className="w-24 h-24 sm:w-32 sm:h-32 aspect-square">
        <RechartsPieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="symbol"
            innerRadius="60%"
            outerRadius="100%"
            strokeWidth={0}
            data-test-id="pie-chart"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload as (typeof chartData)[0];
                return (
                  <div className="rounded-lg border bg-background p-2 shadow-sm text-xs">
                    <div className="font-bold">{data.symbol}</div>
                    <div className="text-muted-foreground">${formatCompact(data.value)}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {data.percentage.toFixed(1)}%
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
        </RechartsPieChart>
      </ChartContainer>

      {/* Legend */}
      <div className="flex flex-col gap-1.5">
        {chartData.map((seg, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: seg.fill }} />
            <span className="font-mono font-medium">{seg.symbol}</span>
            <span className="text-muted-foreground tabular-nums">{seg.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
