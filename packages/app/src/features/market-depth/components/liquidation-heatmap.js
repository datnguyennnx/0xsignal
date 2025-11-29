import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Liquidation Heatmap - lazy loaded ECharts for performance
import { useMemo, lazy, Suspense } from "react";
// Lazy load ECharts (heavy library)
const ReactECharts = lazy(() => import("echarts-for-react"));
import { useTheme } from "@/core/providers/theme-provider";
import { formatUSD, formatCompact } from "@/core/utils/formatters";
import { getChartColors } from "@/core/utils/colors";
export function LiquidationHeatmapComponent({ data, isLoading }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  // useMemo kept - expensive chart option computation
  const option = useMemo(() => {
    if (!data?.levels?.length) return {};
    const c = getChartColors(isDark);
    const prices = data.levels.map((l) => l.price);
    const longData = data.levels.map((l) => l.longLiquidationUsd);
    const shortData = data.levels.map((l) => l.shortLiquidationUsd);
    return {
      backgroundColor: c.bg,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: c.tooltipBg,
        borderColor: c.tooltipBorder,
        textStyle: { color: c.tooltipText },
        padding: 12,
        formatter: (params) => {
          const price = params[0]?.axisValue;
          let totalLong = 0,
            totalShort = 0;
          params.forEach((p) => {
            if (p.seriesName === "Longs") totalLong = p.value;
            if (p.seriesName === "Shorts") totalShort = p.value;
          });
          return `
            <div style="font-weight:600;margin-bottom:8px">Price: ${Number(price).toLocaleString()}</div>
            <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:4px">
              <span>Total:</span><span style="font-family:monospace;font-weight:600">${formatUSD(totalLong + totalShort)}</span>
            </div>
            <div style="height:1px;background:${c.grid};margin:8px 0"></div>
            <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:4px">
              <span style="color:${c.loss}">Longs:</span><span style="font-family:monospace">${formatUSD(totalLong)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px">
              <span style="color:${c.gain}">Shorts:</span><span style="font-family:monospace">${formatUSD(totalShort)}</span>
            </div>
          `;
        },
      },
      grid: { top: 10, right: 10, bottom: 10, left: 10, containLabel: true },
      xAxis: {
        type: "category",
        data: prices,
        axisLabel: {
          color: c.text,
          formatter: (v) => `${Number(v).toLocaleString()}`,
          rotate: 45,
        },
        axisLine: { lineStyle: { color: c.grid } },
        axisTick: { lineStyle: { color: c.grid } },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: c.grid, type: "dashed" } },
        axisLabel: { color: c.text, formatter: formatCompact },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: "Longs",
          type: "bar",
          stack: "total",
          data: longData,
          itemStyle: { color: c.loss, borderRadius: [0, 0, 4, 4] },
          emphasis: { itemStyle: { color: c.lossDark } },
        },
        {
          name: "Shorts",
          type: "bar",
          stack: "total",
          data: shortData,
          itemStyle: { color: c.gain, borderRadius: [4, 4, 0, 0] },
          emphasis: { itemStyle: { color: c.gainDark } },
        },
        {
          type: "line",
          markLine: {
            symbol: ["none", "none"],
            label: {
              show: true,
              formatter: `Current\n${data.currentPrice.toLocaleString()}`,
              position: "end",
              color: c.warn,
              fontSize: 11,
              fontWeight: "bold",
            },
            data: [{ xAxis: data.currentPrice.toString() }],
            lineStyle: { color: c.warn, type: "dashed", width: 2 },
            animation: false,
          },
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
            children: "Loading liquidation levels",
          }),
        ],
      }),
    });
  }
  if (!data?.levels?.length) {
    return _jsx("div", {
      className: "flex h-full items-center justify-center bg-background",
      children: _jsxs("div", {
        className: "text-center",
        children: [
          _jsx("p", {
            className: "text-sm text-muted-foreground",
            children: "No liquidation data",
          }),
          _jsx("p", {
            className: "text-xs text-muted-foreground mt-1",
            children: "Data may be temporarily unavailable for this asset",
          }),
        ],
      }),
    });
  }
  return _jsx(Suspense, {
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
  });
}
//# sourceMappingURL=liquidation-heatmap.js.map
