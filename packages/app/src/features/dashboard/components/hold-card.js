import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Hold Card - React Compiler handles memoization
import { useNavigate } from "react-router-dom";
import { cn } from "@/core/utils/cn";
import { formatPercent } from "@/core/utils/formatters";
import { CryptoIcon } from "@/components/crypto-icon";
export function HoldCard({ signal }) {
  const navigate = useNavigate();
  const change24h = signal.price?.change24h || 0;
  return _jsxs("button", {
    onClick: () => navigate(`/asset/${signal.symbol.toLowerCase()}`),
    className:
      "flex items-center gap-1.5 px-2 py-1 rounded border border-transparent hover:border-border/40 hover:bg-accent/30 transition-all",
    children: [
      _jsx(CryptoIcon, { symbol: signal.symbol, size: 14 }),
      _jsx("span", {
        className: "font-mono text-xs text-muted-foreground",
        children: signal.symbol.toUpperCase(),
      }),
      _jsx("span", {
        className: cn("text-[10px] tabular-nums", change24h > 0 ? "text-gain/70" : "text-loss/70"),
        children: formatPercent(change24h),
      }),
    ],
  });
}
//# sourceMappingURL=hold-card.js.map
