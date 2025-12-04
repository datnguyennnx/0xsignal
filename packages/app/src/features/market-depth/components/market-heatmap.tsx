import { useMemo, lazy, Suspense } from "react";
import type { MarketHeatmap } from "@0xsignal/shared";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/core/providers/theme-provider";
import { formatUSD, formatIntlCompact } from "@/core/utils/formatters";
import { getChartColors, getHeatmapColor } from "@/core/utils/colors";

const ReactECharts = lazy(() => import("echarts-for-react"));

interface MarketHeatmapProps {
  data: MarketHeatmap;
  isLoading?: boolean;
}

export function MarketHeatmapComponent({ data, isLoading }: MarketHeatmapProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const option = useMemo(() => {
    if (!data?.cells?.length) return {};
    const c = getChartColors(isDark);

    const formattedData = data.cells.map((cell) => ({
      name: cell.symbol.toUpperCase(),
      value: cell.marketCap,
      custom: {
        price: cell.price,
        change24h: cell.change24h,
        category: cell.category,
        marketCap: cell.marketCap,
        volume24h: cell.volume24h,
      },
      itemStyle: {
        color: getHeatmapColor(cell.change24h, isDark),
        borderRadius: 6,
        borderColor: c.border,
        borderWidth: 2,
      },
    }));

    return {
      backgroundColor: c.bg,
      tooltip: {
        trigger: "item",
        backgroundColor: c.tooltipBg,
        borderColor: c.tooltipBorder,
        borderRadius: 8,
        textStyle: { color: c.tooltipText },
        formatter: (params: any) => {
          const { name, data: d } = params;
          const { price, change24h, category, marketCap, volume24h } = d.custom;
          const changeColor = change24h >= 0 ? c.gain : c.loss;
          return `
            <div style="font-weight:600;font-size:14px;margin-bottom:8px">${name}</div>
            <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:4px">
              <span>Price:</span><span style="font-family:monospace">${formatUSD(price)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:4px">
              <span>Change:</span><span style="font-family:monospace;color:${changeColor};font-weight:600">${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:4px">
              <span>Market Cap:</span><span style="font-family:monospace">${formatIntlCompact(marketCap)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:4px">
              <span>Volume 24h:</span><span style="font-family:monospace">${formatIntlCompact(volume24h)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px">
              <span>Category:</span><span style="opacity:0.7">${category}</span>
            </div>
          `;
        },
      },
      series: [
        {
          type: "treemap",
          data: formattedData,
          width: "100%",
          height: "100%",
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          squareRatio: 1,
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          label: {
            show: true,
            formatter: (params: any) =>
              `${params.name}\n${params.data.custom.change24h >= 0 ? "+" : ""}${params.data.custom.change24h.toFixed(2)}%`,
            fontSize: 13,
            fontWeight: "bold",
            color: isDark ? "#fafafa" : "#ffffff",
            align: "center",
            verticalAlign: "middle",
            textShadowColor: "rgba(0,0,0,0.6)",
            textShadowBlur: 4,
          },
          upperLabel: { show: false },
          itemStyle: { borderColor: c.border, borderWidth: 2, gapWidth: 2 },
          levels: [{ itemStyle: { borderColor: c.border, borderWidth: 2, gapWidth: 2 } }],
        },
      ],
    };
  }, [data, isDark]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-4">
        <div className="text-center space-y-3">
          <Skeleton className="h-5 w-5 rounded-full mx-auto" />
          <p className="text-xs text-muted-foreground">Loading market heatmap</p>
        </div>
      </div>
    );
  }

  if (!data?.cells?.length) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No market data</p>
          <p className="text-xs text-muted-foreground mt-1">
            Market data may be temporarily unavailable
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center">
            <Skeleton className="h-5 w-5 rounded-full" />
          </div>
        }
      >
        <ReactECharts
          option={option}
          style={{ height: "100%", width: "100%" }}
          opts={{ renderer: "canvas" }}
          notMerge
        />
      </Suspense>
    </div>
  );
}
