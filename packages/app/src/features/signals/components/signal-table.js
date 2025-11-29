import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Signal Table - Mobile-first responsive design
import { useNavigate } from "react-router-dom";
import { formatPrice, formatCurrency, formatPercentChange } from "@/core/utils/formatters";
import { cn } from "@/core/utils/cn";
import { CryptoIcon } from "@/components/crypto-icon";
const strongSignalMap = {
  buy: "STRONG_BUY",
  sell: "STRONG_SELL",
  hold: "",
};
// Mobile Card View
function SignalRow({ signal, type }) {
  const navigate = useNavigate();
  const isStrong = signal.overallSignal === strongSignalMap[type];
  const price = signal.price?.price || 0;
  const change24h = signal.price?.change24h || 0;
  const volume24h = signal.price?.volume24h || 0;
  const riskScore = signal.riskScore || 0;
  const noiseValue = signal.noise?.value ?? 0;
  const isHold = type === "hold";
  return _jsx("button", {
    onClick: () => navigate(`/asset/${signal.symbol.toLowerCase()}`),
    className:
      "w-full px-3 py-2.5 border-b border-border/30 text-left active:bg-muted/30 transition-colors",
    children: _jsxs("div", {
      className: "flex items-center justify-between gap-3",
      children: [
        _jsxs("div", {
          className: "flex items-center gap-2.5 min-w-0",
          children: [
            _jsx(CryptoIcon, { symbol: signal.symbol, size: 20, className: "shrink-0" }),
            _jsxs("div", {
              className: "min-w-0",
              children: [
                _jsxs("div", {
                  className: "flex items-center gap-1.5",
                  children: [
                    _jsx("span", {
                      className: cn("font-medium text-sm", isHold && "text-muted-foreground"),
                      children: signal.symbol.toUpperCase(),
                    }),
                    isStrong &&
                      _jsx("span", {
                        className: "text-[9px] px-1 py-0.5 rounded bg-muted font-medium",
                        children: "STRONG",
                      }),
                  ],
                }),
                _jsxs("div", {
                  className: cn("text-xs tabular-nums", isHold ? "text-muted-foreground" : ""),
                  children: ["$", formatPrice(price)],
                }),
              ],
            }),
          ],
        }),
        _jsxs("div", {
          className: "flex items-center gap-4 text-right",
          children: [
            _jsxs("div", {
              children: [
                _jsx("div", {
                  className: cn(
                    "text-sm font-medium tabular-nums",
                    isHold
                      ? change24h > 0
                        ? "text-gain/70"
                        : "text-loss/70"
                      : change24h > 0
                        ? "text-gain"
                        : "text-loss"
                  ),
                  children: formatPercentChange(change24h),
                }),
                _jsx("div", {
                  className: "text-[10px] text-muted-foreground sm:hidden",
                  children: "24h",
                }),
              ],
            }),
            _jsxs("div", {
              className: "hidden sm:block min-w-[60px]",
              children: [
                _jsx("div", {
                  className: "text-sm tabular-nums text-muted-foreground",
                  children: formatCurrency(volume24h),
                }),
                _jsx("div", { className: "text-[10px] text-muted-foreground", children: "Vol" }),
              ],
            }),
            isHold
              ? _jsxs(_Fragment, {
                  children: [
                    _jsxs("div", {
                      className: "min-w-[32px]",
                      children: [
                        _jsx("div", {
                          className: cn(
                            "text-sm tabular-nums",
                            riskScore > 60 ? "text-warn" : "text-muted-foreground"
                          ),
                          children: riskScore,
                        }),
                        _jsx("div", {
                          className: "text-[10px] text-muted-foreground sm:hidden",
                          children: "Risk",
                        }),
                      ],
                    }),
                    _jsxs("div", {
                      className: "hidden sm:block min-w-[32px]",
                      children: [
                        _jsx("div", {
                          className: cn(
                            "text-sm tabular-nums",
                            noiseValue > 60 ? "text-warn" : "text-muted-foreground"
                          ),
                          children: noiseValue,
                        }),
                        _jsx("div", {
                          className: "text-[10px] text-muted-foreground",
                          children: "Noise",
                        }),
                      ],
                    }),
                  ],
                })
              : _jsxs("div", {
                  className: "min-w-[40px]",
                  children: [
                    _jsxs("div", {
                      className: "text-sm font-medium tabular-nums",
                      children: [signal.confidence || 0, "%"],
                    }),
                    _jsx("div", {
                      className: "text-[10px] text-muted-foreground sm:hidden",
                      children: "Conf",
                    }),
                  ],
                }),
          ],
        }),
      ],
    }),
  });
}
export function SignalTable({ signals, type }) {
  const isHold = type === "hold";
  if (signals.length === 0) {
    return _jsxs("div", {
      className: "rounded-md border p-8 text-center",
      children: [
        _jsxs("p", {
          className: "text-sm text-muted-foreground",
          children: [
            type === "buy" && "No bullish setups detected",
            type === "sell" && "No bearish setups detected",
            type === "hold" && "No neutral positions",
          ],
        }),
        _jsx("p", {
          className: "text-xs text-muted-foreground mt-1",
          children: "Market conditions may have changed",
        }),
      ],
    });
  }
  return _jsxs("div", {
    className: "rounded-md border overflow-hidden",
    children: [
      _jsxs("div", {
        className:
          "hidden sm:grid sm:grid-cols-[1fr_80px_80px_60px_60px] gap-4 px-3 py-2 bg-muted/30 text-xs text-muted-foreground border-b",
        children: [
          _jsx("div", { children: "Asset" }),
          _jsx("div", { className: "text-right", children: "24h Change" }),
          _jsx("div", { className: "text-right", children: "Volume" }),
          isHold
            ? _jsxs(_Fragment, {
                children: [
                  _jsx("div", { className: "text-right", children: "Risk" }),
                  _jsx("div", { className: "text-right", children: "Noise" }),
                ],
              })
            : _jsx("div", { className: "text-right col-span-2", children: "Confidence" }),
        ],
      }),
      _jsx("div", {
        className: "divide-y divide-border/30",
        children: signals.map((signal) =>
          _jsx(SignalRow, { signal: signal, type: type }, signal.symbol)
        ),
      }),
    ],
  });
}
//# sourceMappingURL=signal-table.js.map
