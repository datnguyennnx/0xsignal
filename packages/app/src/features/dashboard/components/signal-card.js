import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Signal Card - Mobile-first responsive design
import { useNavigate } from "react-router-dom";
import { cn } from "@/core/utils/cn";
import { formatPrice, formatPercent } from "@/core/utils/formatters";
import { CryptoIcon } from "@/components/crypto-icon";
export function SignalCard({ signal, type }) {
  const navigate = useNavigate();
  const overallSignal = signal.overallSignal;
  const isStrong =
    type !== "hold" && overallSignal === (type === "buy" ? "STRONG_BUY" : "STRONG_SELL");
  const confidence = signal.confidence || 0;
  const price = signal.price?.price || 0;
  const change24h = signal.price?.change24h || 0;
  const riskScore = signal.riskScore || 0;
  return _jsx("button", {
    onClick: () => navigate(`/asset/${signal.symbol.toLowerCase()}`),
    className: cn(
      "w-full px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-sm border transition-all text-left",
      "active:scale-[0.99] hover:border-foreground/20",
      type === "hold"
        ? "border-border/30"
        : isStrong
          ? type === "buy"
            ? "border-gain/30 bg-gain/5"
            : "border-loss/30 bg-loss/5"
          : "border-border/50"
    ),
    children: _jsxs("div", {
      className: "flex items-center justify-between gap-2",
      children: [
        _jsxs("div", {
          className: "flex items-center gap-2 min-w-0",
          children: [
            _jsx(CryptoIcon, { symbol: signal.symbol, size: 18, className: "shrink-0" }),
            _jsxs("div", {
              className: "min-w-0",
              children: [
                _jsxs("div", {
                  className: "flex items-center gap-1.5",
                  children: [
                    _jsx("span", {
                      className: "font-mono font-medium text-xs sm:text-sm",
                      children: signal.symbol.toUpperCase(),
                    }),
                    isStrong &&
                      _jsx("span", {
                        className:
                          "hidden sm:inline text-[9px] px-1 py-0.5 rounded bg-muted font-medium",
                        children: "STRONG",
                      }),
                  ],
                }),
                _jsxs("div", {
                  className: "text-[10px] sm:text-xs text-muted-foreground tabular-nums",
                  children: ["$", formatPrice(price)],
                }),
              ],
            }),
          ],
        }),
        _jsxs("div", {
          className: "flex items-center gap-3 sm:gap-4 text-right",
          children: [
            _jsxs("div", {
              children: [
                _jsx("div", {
                  className: "hidden sm:block text-[9px] text-muted-foreground uppercase",
                  children: "24h",
                }),
                _jsx("div", {
                  className: cn(
                    "text-xs sm:text-sm font-medium tabular-nums",
                    change24h > 0 ? "text-gain" : "text-loss"
                  ),
                  children: formatPercent(change24h),
                }),
              ],
            }),
            _jsxs("div", {
              children: [
                _jsx("div", {
                  className: "hidden sm:block text-[9px] text-muted-foreground uppercase",
                  children: "Conf",
                }),
                _jsxs("div", {
                  className: cn(
                    "text-xs sm:text-sm font-medium tabular-nums",
                    type === "buy" ? "text-gain" : type === "sell" ? "text-loss" : ""
                  ),
                  children: [confidence, "%"],
                }),
              ],
            }),
            _jsxs("div", {
              className: "hidden sm:block",
              children: [
                _jsx("div", {
                  className: "text-[9px] text-muted-foreground uppercase",
                  children: "Risk",
                }),
                _jsx("div", {
                  className: cn(
                    "text-sm font-medium tabular-nums",
                    riskScore > 70 ? "text-loss" : riskScore > 40 ? "text-warn" : "text-gain"
                  ),
                  children: riskScore,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  });
}
//# sourceMappingURL=signal-card.js.map
