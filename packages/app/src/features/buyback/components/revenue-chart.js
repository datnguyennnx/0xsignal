import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Revenue Chart - memo kept for chart library integration
import { memo, useMemo } from "react";
import { Area, AreaChart, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { formatCompact } from "@/core/utils/formatters";
function CustomTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null;
  return _jsxs("div", {
    className: "bg-background border border-border rounded px-2 py-1.5 text-xs shadow-sm",
    children: [
      _jsx("div", { className: "text-muted-foreground", children: payload[0].payload.dateLabel }),
      _jsxs("div", {
        className: "font-medium tabular-nums",
        children: ["$", formatCompact(payload[0].value)],
      }),
    ],
  });
}
export const RevenueChart = memo(function RevenueChart({ data }) {
  // useMemo kept - data transformation
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
  // useMemo kept - stats calculation
  const stats = useMemo(() => {
    if (data.length === 0) return { max: 0, avg: 0 };
    const values = data.map((d) => d.revenue);
    const max = Math.max(...values);
    const total = values.reduce((a, b) => a + b, 0);
    return { max, avg: total / values.length };
  }, [data]);
  if (data.length < 2) {
    return _jsx("div", {
      className: "h-48 flex items-center justify-center",
      children: _jsxs("div", {
        className: "text-center",
        children: [
          _jsx("p", {
            className: "text-sm text-muted-foreground",
            children: "Insufficient revenue history",
          }),
          _jsx("p", {
            className: "text-xs text-muted-foreground mt-1",
            children: "Need at least 2 data points to display chart",
          }),
        ],
      }),
    });
  }
  return _jsxs("div", {
    className: "space-y-3",
    children: [
      _jsxs("div", {
        className: "flex items-center justify-between text-xs",
        children: [
          _jsxs("div", {
            children: [
              _jsx("span", { className: "text-muted-foreground", children: "Daily Revenue" }),
              _jsxs("span", {
                className: "text-muted-foreground/60 ml-1",
                children: ["(", data.length, "d)"],
              }),
            ],
          }),
          _jsxs("div", {
            className: "flex items-center gap-3 text-muted-foreground",
            children: [
              _jsxs("span", {
                children: [
                  "Avg",
                  " ",
                  _jsxs("span", {
                    className: "text-foreground tabular-nums font-medium",
                    children: ["$", formatCompact(stats.avg)],
                  }),
                ],
              }),
              _jsxs("span", {
                children: [
                  "Peak",
                  " ",
                  _jsxs("span", {
                    className: "text-foreground tabular-nums font-medium",
                    children: ["$", formatCompact(stats.max)],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      _jsx("div", {
        className: "h-56 sm:h-72",
        children: _jsx(ResponsiveContainer, {
          width: "100%",
          height: "100%",
          children: _jsxs(AreaChart, {
            data: chartData,
            margin: { top: 4, right: 4, bottom: 0, left: 0 },
            children: [
              _jsx("defs", {
                children: _jsxs("linearGradient", {
                  id: "revenueGradient",
                  x1: "0",
                  y1: "0",
                  x2: "0",
                  y2: "1",
                  children: [
                    _jsx("stop", { offset: "0%", stopColor: "currentColor", stopOpacity: 0.15 }),
                    _jsx("stop", { offset: "100%", stopColor: "currentColor", stopOpacity: 0.02 }),
                  ],
                }),
              }),
              _jsx(XAxis, {
                dataKey: "dateLabel",
                tickLine: false,
                axisLine: false,
                tick: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
                tickMargin: 8,
                interval: "preserveStartEnd",
                minTickGap: 50,
              }),
              _jsx(YAxis, {
                tickLine: false,
                axisLine: false,
                tick: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
                tickFormatter: (v) => formatCompact(v),
                tickMargin: 4,
                width: 40,
              }),
              _jsx(Tooltip, {
                content: _jsx(CustomTooltip, {}),
                cursor: { stroke: "hsl(var(--border))" },
              }),
              _jsx(Area, {
                type: "monotone",
                dataKey: "revenue",
                stroke: "currentColor",
                strokeWidth: 1.5,
                fill: "url(#revenueGradient)",
                className: "text-foreground",
                isAnimationActive: false,
              }),
            ],
          }),
        }),
      }),
    ],
  });
});
//# sourceMappingURL=revenue-chart.js.map
