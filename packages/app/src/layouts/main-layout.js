import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useLocation } from "react-router-dom";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/core/utils/cn";
import { BarChart3, Wallet, Home } from "lucide-react";
const NAV_ITEMS = [
  { path: "/", label: "Signals", icon: Home, desc: "Trading signals" },
  { path: "/market-depth", label: "Depth", icon: BarChart3, desc: "Market heatmap & liquidations" },
  { path: "/buyback", label: "Buyback", icon: Wallet, desc: "Protocol revenue yields" },
];
export function Layout({ children }) {
  const location = useLocation();
  return _jsxs("div", {
    className: "flex flex-col min-h-screen bg-background",
    children: [
      _jsx("header", {
        className:
          "hidden sm:block sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40",
        children: _jsx("div", {
          className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8",
          children: _jsxs("div", {
            className: "flex items-center justify-between h-14",
            children: [
              _jsxs(Link, {
                to: "/",
                className: "flex items-center gap-2 hover:opacity-80 transition-opacity",
                children: [
                  _jsx("span", {
                    className: "text-lg font-semibold tracking-tight",
                    children: "0xSignal",
                  }),
                  _jsx("span", {
                    className: "text-xs text-muted-foreground hidden lg:inline",
                    children: "Quantitative Crypto Analysis",
                  }),
                ],
              }),
              _jsx("nav", {
                className: "flex items-center gap-1",
                children: NAV_ITEMS.map((item) => {
                  const isActive = location.pathname === item.path;
                  return _jsx(
                    Link,
                    {
                      to: item.path,
                      title: item.desc,
                      className: cn(
                        "px-3 py-1.5 text-sm font-medium rounded transition-colors",
                        isActive
                          ? "text-foreground bg-muted"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      ),
                      children: item.label,
                    },
                    item.path
                  );
                }),
              }),
              _jsx(ModeToggle, {}),
            ],
          }),
        }),
      }),
      _jsx("header", {
        className:
          "sm:hidden sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40",
        children: _jsxs("div", {
          className: "flex items-center justify-between h-12 px-4",
          children: [
            _jsx(Link, {
              to: "/",
              className: "text-base font-semibold tracking-tight",
              children: "0xSignal",
            }),
            _jsx(ModeToggle, {}),
          ],
        }),
      }),
      _jsx("main", { className: "flex-1 pb-16 sm:pb-0", children: children }),
      _jsx("nav", {
        className:
          "sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border/40 safe-area-pb",
        children: _jsx("div", {
          className: "flex items-center justify-around h-14",
          children: NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return _jsxs(
              Link,
              {
                to: item.path,
                "aria-label": item.desc,
                className: cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground"
                ),
                children: [
                  _jsx(Icon, { className: "w-5 h-5", strokeWidth: isActive ? 2.5 : 2 }),
                  _jsx("span", { className: "text-[10px] font-medium", children: item.label }),
                ],
              },
              item.path
            );
          }),
        }),
      }),
      _jsx("footer", {
        className: "hidden sm:block border-t border-border/40",
        children: _jsx("div", {
          className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4",
          children: _jsxs("div", {
            className: "flex items-center justify-between text-xs text-muted-foreground",
            children: [
              _jsxs("div", {
                className: "flex items-center gap-4",
                children: [
                  _jsxs("span", { children: ["\u00A9 ", new Date().getFullYear(), " 0xSignal"] }),
                  _jsx("span", { className: "hidden md:inline", children: "\u00B7" }),
                  _jsx("span", {
                    className: "hidden md:inline",
                    children: "Multi-strategy signal analysis for crypto assets",
                  }),
                ],
              }),
              _jsx("div", {
                className: "flex items-center gap-3",
                children: _jsx("span", {
                  children: "Data: CoinGecko \u00B7 DefiLlama \u00B7 Binance",
                }),
              }),
            ],
          }),
        }),
      }),
    ],
  });
}
//# sourceMappingURL=main-layout.js.map
