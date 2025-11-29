import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Market Heatmap - lazy loaded ECharts for performance
import { useMemo, lazy, Suspense } from "react";
// Lazy load ECharts (heavy library)
const ReactECharts = lazy(() => import("echarts-for-react"));
import { useTheme } from "@/core/providers/theme-provider";
import { formatUSD, formatIntlCompact } from "@/core/utils/formatters";
import { getChartColors, getHeatmapColor } from "@/core/utils/colors";
export function MarketHeatmapComponent({ data, isLoading }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  // useMemo kept - expensive chart option computation
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
        borderRadius: 3,
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
        textStyle: { color: c.tooltipText },
        formatter: (params) => {
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
          squareRatio: 0.8,
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          label: {
            show: true,
            formatter: (params) => {
              const change = params.data.custom.change24h;
              return `${params.name}\n${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
            },
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
    return _jsx("div", {
      className: "flex h-full items-center justify-center bg-background",
      children: _jsxs("div", {
        className: "text-center space-y-2",
        children: [
          _jsx("div", {
            className:
              "h-5 w-5 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin mx-auto",
          }),
          _jsx("p", {
            className: "text-xs text-muted-foreground",
            children: "Loading market heatmap",
          }),
        ],
      }),
    });
  }
  if (!data?.cells?.length) {
    return _jsx("div", {
      className: "flex h-full items-center justify-center bg-background",
      children: _jsxs("div", {
        className: "text-center",
        children: [
          _jsx("p", { className: "text-sm text-muted-foreground", children: "No market data" }),
          _jsx("p", {
            className: "text-xs text-muted-foreground mt-1",
            children: "Market data may be temporarily unavailable",
          }),
        ],
      }),
    });
  }
  return _jsx("div", {
    className: "h-full w-full",
    children: _jsx(Suspense, {
      fallback: _jsx("div", {
        className: "flex h-full items-center justify-center",
        children: _jsx("div", {
          className:
            "h-5 w-5 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin",
        }),
      }),
      children: _jsx(ReactECharts, {
        option: option,
        style: { height: "100%", width: "100%" },
        opts: { renderer: "canvas" },
        notMerge: true,
      }),
    }),
  });
}
//# sourceMappingURL=market-heatmap.js.map
