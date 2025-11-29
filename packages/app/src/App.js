import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/core/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/layouts/main-layout";
// Lazy load all page components for code splitting
const MarketDashboard = lazy(() =>
  import("@/features/dashboard/pages/market-dashboard").then((m) => ({
    default: m.MarketDashboard,
  }))
);
const AllBuySignals = lazy(() =>
  import("@/features/signals/pages/buy-signals").then((m) => ({ default: m.AllBuySignals }))
);
const AllSellSignals = lazy(() =>
  import("@/features/signals/pages/sell-signals").then((m) => ({ default: m.AllSellSignals }))
);
const AllHoldSignals = lazy(() =>
  import("@/features/signals/pages/hold-signals").then((m) => ({ default: m.AllHoldSignals }))
);
const AssetDetail = lazy(() =>
  import("@/features/asset-detail/pages/asset-detail").then((m) => ({ default: m.AssetDetail }))
);
const MarketDepthPage = lazy(() =>
  import("@/features/market-depth/pages/market-depth").then((m) => ({ default: m.MarketDepthPage }))
);
const BuybackSignalsPage = lazy(() =>
  import("@/features/buyback/pages/buyback-signals").then((m) => ({
    default: m.BuybackSignalsPage,
  }))
);
// Minimal loading fallback
function PageLoader() {
  return _jsx("div", {
    className: "flex items-center justify-center min-h-[50vh]",
    children: _jsx("div", {
      className:
        "h-6 w-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin",
    }),
  });
}
function App() {
  return _jsx(ThemeProvider, {
    defaultTheme: "dark",
    storageKey: "vite-ui-theme",
    children: _jsx(TooltipProvider, {
      children: _jsx(BrowserRouter, {
        children: _jsx(Layout, {
          children: _jsx(Suspense, {
            fallback: _jsx(PageLoader, {}),
            children: _jsxs(Routes, {
              children: [
                _jsx(Route, { path: "/", element: _jsx(MarketDashboard, {}) }),
                _jsx(Route, { path: "/buy", element: _jsx(AllBuySignals, {}) }),
                _jsx(Route, { path: "/sell", element: _jsx(AllSellSignals, {}) }),
                _jsx(Route, { path: "/hold", element: _jsx(AllHoldSignals, {}) }),
                _jsx(Route, { path: "/asset/:symbol", element: _jsx(AssetDetail, {}) }),
                _jsx(Route, { path: "/market-depth", element: _jsx(MarketDepthPage, {}) }),
                _jsx(Route, { path: "/buyback", element: _jsx(BuybackSignalsPage, {}) }),
              ],
            }),
          }),
        }),
      }),
    }),
  });
}
export default App;
//# sourceMappingURL=App.js.map
