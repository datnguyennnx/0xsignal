import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Protocol Detail Dialog - memo kept for Dialog (prevents re-mount)
import { memo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cachedBuybackDetail } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { RevenueChart } from "./revenue-chart";
import { cn } from "@/core/utils/cn";
import { formatCurrency } from "@/core/utils/formatters";
function Stat({ label, value, variant }) {
  return _jsxs("div", {
    children: [
      _jsx("div", { className: "text-xs text-muted-foreground", children: label }),
      _jsx("div", {
        className: cn(
          "text-lg font-semibold tabular-nums mt-0.5 sm:text-xl",
          variant === "gain" && "text-gain",
          variant === "loss" && "text-loss"
        ),
        children: value,
      }),
    ],
  });
}
function DetailContent({ protocol }) {
  const {
    data: detail,
    isLoading,
    isError,
  } = useEffectQuery(() => cachedBuybackDetail(protocol), [protocol]);
  if (isLoading) {
    return _jsxs("div", {
      className: "py-12 flex flex-col items-center justify-center gap-2",
      children: [
        _jsx("div", {
          className:
            "h-5 w-5 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin",
        }),
        _jsx("p", {
          className: "text-xs text-muted-foreground",
          children: "Loading protocol details",
        }),
      ],
    });
  }
  if (isError || !detail) {
    return _jsxs("div", {
      className: "py-12 text-center",
      children: [
        _jsx("p", {
          className: "text-sm text-muted-foreground",
          children: "Unable to load protocol data",
        }),
        _jsx("p", {
          className: "text-xs text-muted-foreground mt-1",
          children: "Revenue data may be temporarily unavailable",
        }),
      ],
    });
  }
  const yieldRate = detail.signal.annualizedBuybackRate;
  const growth = detail.signal.revenueGrowth7d ?? 0;
  return _jsxs("div", {
    className: "space-y-5",
    children: [
      _jsxs("div", {
        className: "grid grid-cols-2 gap-4 sm:grid-cols-4",
        children: [
          _jsx(Stat, { label: "Revenue 24h", value: formatCurrency(detail.signal.revenue24h) }),
          _jsx(Stat, { label: "Market Cap", value: formatCurrency(detail.signal.marketCap) }),
          _jsx(Stat, {
            label: "Yield",
            value: `${yieldRate.toFixed(2)}%`,
            variant: yieldRate >= 10 ? "gain" : "default",
          }),
          _jsx(Stat, {
            label: "P/Rev",
            value: detail.signal.impliedPE > 0 ? `${detail.signal.impliedPE.toFixed(1)}x` : "—",
          }),
        ],
      }),
      growth !== 0 &&
        _jsxs("div", {
          className: "flex items-center gap-2 text-sm",
          children: [
            _jsx("span", { className: "text-muted-foreground", children: "7d Growth" }),
            _jsxs("span", {
              className: cn("tabular-nums font-medium", growth > 0 ? "text-gain" : "text-loss"),
              children: [growth > 0 ? "+" : "", growth.toFixed(1), "%"],
            }),
          ],
        }),
      detail.dailyRevenue.length > 0 &&
        _jsx("div", {
          className: "pt-2",
          children: _jsx(RevenueChart, { data: detail.dailyRevenue }),
        }),
      detail.revenueSource &&
        _jsxs("div", {
          className: "pt-2 border-t border-border/40",
          children: [
            _jsx("div", {
              className: "text-xs text-muted-foreground mb-1",
              children: "Revenue Source",
            }),
            _jsx("p", { className: "text-sm leading-relaxed", children: detail.revenueSource }),
          ],
        }),
      _jsxs("div", {
        className: "grid grid-cols-2 gap-4 pt-2 border-t border-border/40 text-sm",
        children: [
          _jsxs("div", {
            children: [
              _jsx("div", {
                className: "text-xs text-muted-foreground mb-0.5",
                children: "Category",
              }),
              _jsx("div", { children: detail.signal.category }),
            ],
          }),
          _jsxs("div", {
            children: [
              _jsx("div", {
                className: "text-xs text-muted-foreground mb-0.5",
                children: "Chains",
              }),
              _jsx("div", {
                className: "truncate",
                children: detail.signal.chains.slice(0, 3).join(", "),
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
// memo kept - Dialog should not re-mount on parent re-renders
export const ProtocolDetailDialog = memo(function ProtocolDetailDialog({
  signal,
  open,
  onOpenChange,
}) {
  if (!signal) return null;
  const protocolSlug = signal.protocol.toLowerCase().replace(/\s+/g, "-");
  return _jsx(Dialog, {
    open: open,
    onOpenChange: onOpenChange,
    children: _jsxs(DialogContent, {
      className: "max-w-4xl w-[calc(100%-1rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6",
      children: [
        _jsx(DialogHeader, {
          className: "pb-3",
          children: _jsxs(DialogTitle, {
            className: "flex items-center gap-2 text-lg sm:text-xl",
            children: [
              _jsx("span", { className: "font-semibold", children: signal.symbol.toUpperCase() }),
              _jsx("span", {
                className: "font-normal text-muted-foreground truncate",
                children: signal.protocol,
              }),
            ],
          }),
        }),
        _jsx(DetailContent, { protocol: protocolSlug }),
      ],
    }),
  });
});
//# sourceMappingURL=protocol-detail-dialog.js.map
