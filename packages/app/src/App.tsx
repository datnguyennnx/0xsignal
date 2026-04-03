/**
 * @overview Main App Component
 *
 * Sets up routing, theme, and preloading strategy for optimal initial load.
 *
 * @performance
 * - Lazy loads heavy routes (AssetDetail, OrderbookPage, TradingChart)
 * - Preloads critical routes 2s after mount to not block initial render
 * - Uses Suspense for streaming SSR-like experience
 */
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/core/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HyperliquidWsProvider } from "@/features/trade/contexts/hyperliquid-ws-context";
import { Layout } from "@/layouts/main-layout";
import { MarketDashboard } from "@/pages/market-dashboard";
import { SettingsPage } from "@/pages/settings";
import { ErrorBoundary } from "@/components/error-boundary";

// Lazy-loaded routes for code splitting
const AssetDetail = lazy(() =>
  import("@/pages/asset-detail").then((m) => ({ default: m.AssetDetail }))
);
const OrderbookPage = lazy(() =>
  import("@/pages/orderbook-page").then((m) => ({ default: m.OrderbookPage }))
);
const NotFoundPage = lazy(() =>
  import("@/pages/not-found").then((m) => ({ default: m.NotFoundPage }))
);

/**
 * Preloads heavy components after initial render
 * @strategy Wait for initial paint (2s) then prefetch
 * @benefit Reduces navigation latency for common user flows
 */
const usePreloadRoutes = () => {
  useEffect(() => {
    const preloadTimer = setTimeout(() => {
      // Most visited: trade detail page
      import("@/pages/asset-detail");
      // Heavy chart component
      import("@/features/chart/trading-chart");
    }, 2000);
    return () => clearTimeout(preloadTimer);
  }, []);
};

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="h-6 w-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
    </div>
  );
}

function App() {
  usePreloadRoutes();
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <HyperliquidWsProvider>
          <TooltipProvider>
            <BrowserRouter>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<MarketDashboard />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/trade" element={<Navigate to="/trade/btc" replace />} />
                    <Route path="/trade/:symbol" element={<AssetDetail />} />
                    <Route path="/trade/:symbol/orderbook" element={<OrderbookPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
              </Layout>
            </BrowserRouter>
          </TooltipProvider>
        </HyperliquidWsProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
