import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { MarketHeatmap } from "@0xsignal/shared";
import { useTheme } from "@/core/theme/theme-provider";

interface MarketHeatmapProps {
  data: MarketHeatmap;
  isLoading?: boolean;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

const formatCompact = (val: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", compactDisplay: "short" }).format(val);

// Color scales - using 500+ shades for better visibility
const COLORS = {
  light: {
    gainStrong: "#15803d", // green-700
    gainMedium: "#16a34a", // green-600
    gainLight: "#22c55e", // green-500
    gainSubtle: "#22c55e", // green-500 (min)
    lossStrong: "#b91c1c", // red-700
    lossMedium: "#dc2626", // red-600
    lossLight: "#ef4444", // red-500
    lossSubtle: "#ef4444", // red-500 (min)
  },
  dark: {
    gainStrong: "#15803d", // green-700
    gainMedium: "#16a34a", // green-600
    gainLight: "#22c55e", // green-500
    gainSubtle: "#22c55e", // green-500 (min)
    lossStrong: "#b91c1c", // red-700
    lossMedium: "#dc2626", // red-600
    lossLight: "#ef4444", // red-500
    lossSubtle: "#ef4444", // red-500 (min)
  },
};

// Get color based on % change - more intense color for higher changes
const getColor = (change: number, isDark: boolean): string => {
  const colors = isDark ? COLORS.dark : COLORS.light;

  if (change >= 8) return colors.gainStrong;
  if (change >= 5) return colors.gainMedium;
  if (change >= 2) return colors.gainLight;
  if (change >= 0) return colors.gainSubtle;
  if (change >= -2) return colors.lossSubtle;
  if (change >= -5) return colors.lossLight;
  if (change >= -8) return colors.lossMedium;
  return colors.lossStrong;
};

export const MarketHeatmapComponent: React.FC<MarketHeatmapProps> = ({ data, isLoading }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const option = useMemo(() => {
    if (!data?.cells?.length) return {};

    // Theme colors - darker for less eye strain
    const bgColor = isDark ? "#0a0a0a" : "#f5f5f5";
    const borderColor = isDark ? "#18181b" : "#ffffff"; // zinc-900 / white
    const tooltipBg = isDark ? "rgba(24, 24, 27, 0.95)" : "rgba(255, 255, 255, 0.95)";
    const tooltipBorder = isDark ? "#3f3f46" : "#e4e4e7";
    const tooltipText = isDark ? "#fafafa" : "#18181b";

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
        color: getColor(cell.change24h, isDark),
        borderRadius: 3,
        borderColor,
        borderWidth: 2,
      },
    }));

    return {
      backgroundColor: bgColor,
      tooltip: {
        trigger: "item",
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: tooltipText },
        formatter: (params: any) => {
          const { name, data: d } = params;
          const { price, change24h, category, marketCap, volume24h } = d.custom;
          const changeColor =
            change24h >= 0 ? (isDark ? "#4ade80" : "#22c55e") : isDark ? "#f87171" : "#ef4444";

          return `
            <div style="font-weight:600;font-size:14px;margin-bottom:8px">${name}</div>
            <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:4px">
              <span>Price:</span><span style="font-family:monospace">${formatCurrency(price)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:4px">
              <span>Change:</span><span style="font-family:monospace;color:${changeColor};font-weight:600">${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:4px">
              <span>Market Cap:</span><span style="font-family:monospace">${formatCompact(marketCap)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:4px">
              <span>Volume 24h:</span><span style="font-family:monospace">${formatCompact(volume24h)}</span>
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
          squareRatio: 0.8,
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          label: {
            show: true,
            formatter: (params: any) => {
              const { name, data: d } = params;
              const change = d.custom.change24h;
              return `${name}\n${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
            },
            fontSize: 13,
            fontWeight: "bold",
            color: "#fff",
            align: "center",
            verticalAlign: "middle",
            textShadowColor: "rgba(0,0,0,0.7)",
            textShadowBlur: 4,
          },
          upperLabel: { show: false },
          itemStyle: {
            borderColor,
            borderWidth: 2,
            gapWidth: 2,
          },
          levels: [
            {
              itemStyle: {
                borderColor,
                borderWidth: 2,
                gapWidth: 2,
              },
            },
          ],
        },
      ],
    };
  }, [data, isDark]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground bg-background">
        Loading market data...
      </div>
    );
  }

  if (!data?.cells?.length) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground bg-background">
        No market data available
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: "100%", width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
    />
  );
};
