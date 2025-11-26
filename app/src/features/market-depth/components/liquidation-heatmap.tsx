import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { LiquidationHeatmap } from "@0xsignal/shared";
import { useTheme } from "@/core/theme/theme-provider";

interface LiquidationHeatmapProps {
  data: LiquidationHeatmap;
  isLoading?: boolean;
}

// Consistent color system - using 500+ shades
const COLORS = {
  light: {
    long: "#22c55e", // green-500
    longHover: "#16a34a", // green-600
    short: "#ef4444", // red-500
    shortHover: "#dc2626", // red-600
    marker: "#f59e0b", // amber-500
  },
  dark: {
    long: "#22c55e", // green-500
    longHover: "#16a34a", // green-600
    short: "#ef4444", // red-500
    shortHover: "#dc2626", // red-600
    marker: "#f59e0b", // amber-500
  },
};

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);

const formatCompact = (value: number) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
};

export const LiquidationHeatmapComponent: React.FC<LiquidationHeatmapProps> = ({
  data,
  isLoading,
}) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const colors = isDark ? COLORS.dark : COLORS.light;

  const option = useMemo(() => {
    if (!data?.levels?.length) return {};

    const prices = data.levels.map((l) => l.price);
    const longData = data.levels.map((l) => l.longLiquidationUsd);
    const shortData = data.levels.map((l) => l.shortLiquidationUsd);

    // Theme colors - darker for less eye strain
    const bgColor = isDark ? "#0a0a0a" : "#f5f5f5";
    const textColor = isDark ? "#a1a1aa" : "#52525b"; // zinc-400 / zinc-600
    const gridColor = isDark ? "#27272a" : "#e4e4e7"; // zinc-800 / zinc-200
    const tooltipBg = isDark ? "rgba(24, 24, 27, 0.95)" : "rgba(255, 255, 255, 0.95)";
    const tooltipBorder = isDark ? "#3f3f46" : "#e4e4e7";
    const tooltipText = isDark ? "#fafafa" : "#18181b";

    return {
      backgroundColor: bgColor,
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: tooltipText },
        padding: 12,
        formatter: (params: any) => {
          const price = params[0]?.axisValue;
          let totalLong = 0;
          let totalShort = 0;

          params.forEach((p: any) => {
            if (p.seriesName === "Longs") totalLong = p.value;
            if (p.seriesName === "Shorts") totalShort = p.value;
          });

          return `
            <div style="font-weight:600;margin-bottom:8px">Price: $${Number(price).toLocaleString()}</div>
            <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:4px">
              <span>Total:</span><span style="font-family:monospace;font-weight:600">${formatCurrency(totalLong + totalShort)}</span>
            </div>
            <div style="height:1px;background:${gridColor};margin:8px 0"></div>
            <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:4px">
              <span style="color:${colors.long}">Longs:</span><span style="font-family:monospace">${formatCurrency(totalLong)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px">
              <span style="color:${colors.short}">Shorts:</span><span style="font-family:monospace">${formatCurrency(totalShort)}</span>
            </div>
          `;
        },
      },
      grid: {
        top: 10,
        right: 10,
        bottom: 10,
        left: 10,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: prices,

        axisLabel: {
          color: textColor,
          formatter: (value: number) => `$${Number(value).toLocaleString()}`,
          rotate: 45,
        },
        axisLine: { lineStyle: { color: gridColor } },
        axisTick: { lineStyle: { color: gridColor } },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: gridColor, type: "dashed" } },
        axisLabel: { color: textColor, formatter: formatCompact },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: "Longs",
          type: "bar",
          stack: "total",
          data: longData,
          itemStyle: { color: colors.long, borderRadius: [0, 0, 4, 4] },
          emphasis: { itemStyle: { color: colors.longHover } },
        },
        {
          name: "Shorts",
          type: "bar",
          stack: "total",
          data: shortData,
          itemStyle: { color: colors.short, borderRadius: [4, 4, 0, 0] },
          emphasis: { itemStyle: { color: colors.shortHover } },
        },
        {
          type: "line",
          markLine: {
            symbol: ["none", "none"],
            label: {
              show: true,
              formatter: `Current\n$${data.currentPrice.toLocaleString()}`,
              position: "end",
              color: colors.marker,
              fontSize: 11,
              fontWeight: "bold",
            },
            data: [{ xAxis: data.currentPrice.toString() }],
            lineStyle: { color: colors.marker, type: "dashed", width: 2 },
            animation: false,
          },
        },
      ],
    };
  }, [data, isDark, colors]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground bg-background">
        Loading liquidation data...
      </div>
    );
  }

  if (!data?.levels?.length) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground bg-background">
        No liquidation data available
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
