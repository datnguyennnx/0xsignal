import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Buyback List - useMemo kept for sorting large lists
import { useState, useMemo } from "react";
import { cn } from "@/core/utils/cn";
import { formatCurrency } from "@/core/utils/formatters";
import { CryptoIcon } from "@/components/crypto-icon";
const strengthStyles = {
  NONE: "text-muted-foreground",
  LOW: "text-muted-foreground",
  MODERATE: "text-foreground",
  HIGH: "text-gain font-medium",
  VERY_HIGH: "text-gain font-semibold",
};
function SortHeader({ label, sortKey, active, desc, onSort, className }) {
  return _jsxs("div", {
    role: "button",
    tabIndex: 0,
    onClick: () => onSort(sortKey),
    onKeyDown: (e) => e.key === "Enter" && onSort(sortKey),
    className: cn(
      "text-xs cursor-pointer select-none transition-colors",
      active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      className
    ),
    children: [label, active && _jsx("span", { className: "ml-0.5", children: desc ? "↓" : "↑" })],
  });
}
function ListRow({ signal, onSelect }) {
  const growth = signal.revenueGrowth7d ?? 0;
  return _jsxs("div", {
    role: "row",
    tabIndex: 0,
    onClick: () => onSelect?.(signal),
    onKeyDown: (e) => e.key === "Enter" && onSelect?.(signal),
    className:
      "flex items-center justify-between py-3 px-2 border-b border-border/30 cursor-pointer hover:bg-muted/30 transition-colors sm:grid sm:grid-cols-[1fr_5rem_5.5rem_4rem_4.5rem] sm:gap-3",
    children: [
      _jsxs("div", {
        className: "flex items-center gap-2.5 min-w-0",
        children: [
          _jsx(CryptoIcon, { symbol: signal.symbol, size: 24 }),
          _jsxs("div", {
            className: "min-w-0",
            children: [
              _jsx("div", {
                className: "font-medium text-sm truncate",
                children: signal.symbol.toUpperCase(),
              }),
              _jsx("div", {
                className: "text-xs text-muted-foreground truncate",
                children: signal.category,
              }),
            ],
          }),
        ],
      }),
      _jsxs("div", {
        className: "flex items-center gap-3 sm:hidden",
        children: [
          growth !== 0 &&
            _jsxs("span", {
              className: cn("text-xs tabular-nums", growth > 0 ? "text-gain" : "text-loss"),
              children: [growth > 0 ? "+" : "", growth.toFixed(0), "%"],
            }),
          _jsxs("span", {
            className: cn("text-sm tabular-nums", strengthStyles[signal.signal]),
            children: [signal.annualizedBuybackRate.toFixed(1), "%"],
          }),
        ],
      }),
      _jsx("div", {
        className: "hidden sm:block text-right tabular-nums text-sm",
        children: formatCurrency(signal.revenue24h),
      }),
      _jsx("div", {
        className: "hidden sm:block text-right tabular-nums text-sm text-muted-foreground",
        children: formatCurrency(signal.marketCap),
      }),
      _jsx("div", {
        className: cn(
          "hidden sm:block text-right tabular-nums text-sm",
          growth > 0 ? "text-gain" : growth < 0 ? "text-loss" : "text-muted-foreground"
        ),
        children: growth !== 0 ? `${growth > 0 ? "+" : ""}${growth.toFixed(0)}%` : "—",
      }),
      _jsxs("div", {
        className: cn(
          "hidden sm:block text-right tabular-nums text-sm",
          strengthStyles[signal.signal]
        ),
        children: [signal.annualizedBuybackRate.toFixed(1), "%"],
      }),
    ],
  });
}
export function BuybackList({ signals, onSelect }) {
  const [sortKey, setSortKey] = useState("annualizedBuybackRate");
  const [sortDesc, setSortDesc] = useState(true);
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };
  // useMemo kept - sorting large arrays is expensive
  const sorted = useMemo(() => {
    return [...signals].sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      return sortDesc ? bVal - aVal : aVal - bVal;
    });
  }, [signals, sortKey, sortDesc]);
  return _jsxs("div", {
    className: "border rounded-lg overflow-hidden",
    children: [
      _jsxs("div", {
        className:
          "flex items-center justify-between px-2 py-2 bg-muted/30 border-b border-border/50 sm:grid sm:grid-cols-[1fr_5rem_5.5rem_4rem_4.5rem] sm:gap-3",
        children: [
          _jsx("span", { className: "text-xs text-muted-foreground", children: "Protocol" }),
          _jsx("div", {
            className: "flex items-center gap-2 sm:hidden",
            children: _jsx(SortHeader, {
              label: "Yield",
              sortKey: "annualizedBuybackRate",
              active: sortKey === "annualizedBuybackRate",
              desc: sortDesc,
              onSort: handleSort,
            }),
          }),
          _jsx(SortHeader, {
            label: "Rev 24h",
            sortKey: "revenue24h",
            active: sortKey === "revenue24h",
            desc: sortDesc,
            onSort: handleSort,
            className: "hidden sm:block text-right",
          }),
          _jsx(SortHeader, {
            label: "MCap",
            sortKey: "marketCap",
            active: sortKey === "marketCap",
            desc: sortDesc,
            onSort: handleSort,
            className: "hidden sm:block text-right",
          }),
          _jsx(SortHeader, {
            label: "Growth",
            sortKey: "revenueGrowth7d",
            active: sortKey === "revenueGrowth7d",
            desc: sortDesc,
            onSort: handleSort,
            className: "hidden sm:block text-right",
          }),
          _jsx(SortHeader, {
            label: "Yield",
            sortKey: "annualizedBuybackRate",
            active: sortKey === "annualizedBuybackRate",
            desc: sortDesc,
            onSort: handleSort,
            className: "hidden sm:block text-right",
          }),
        ],
      }),
      _jsx("div", {
        className: "max-h-[60vh] overflow-y-auto",
        children: sorted.map((signal) =>
          _jsx(ListRow, { signal: signal, onSelect: onSelect }, signal.protocol)
        ),
      }),
    ],
  });
}
//# sourceMappingURL=buyback-list.js.map
