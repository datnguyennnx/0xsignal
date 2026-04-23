/**
 * @overview Main App Component
 *
 * Sets up routing, theme, and backend market-stream context for the frontend shell.
 * Frontend consumes backend HTTP/WS market data while keeping render-local state in UI hooks.
 *
 * @performance
 * - Lazy loads heavy routes (AssetDetail, TradingChart)
 * - Preloads critical routes 2s after mount to not block initial render
 * - Uses Suspense for streaming SSR-like experience
 */
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/core/providers/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MarketStreamProvider } from "@/features/trade/contexts/market-stream-context";
import { Layout } from "@/layouts/main-layout";
import { ErrorBoundary } from "@/components/error-boundary";

const AssetDetail = lazy(() =>
  import("@/pages/asset-detail").then((m) => ({ default: m.AssetDetail }))
);
const NotFoundPage = lazy(() =>
  import("@/pages/not-found").then((m) => ({ default: m.NotFoundPage }))
);

const usePreloadRoutes = () => {
  useEffect(() => {
    const preloadTimer = setTimeout(() => {
      import("@/pages/asset-detail");
      import("@/features/chart/trading-chart");
    }, 2000);
    return () => clearTimeout(preloadTimer);
  }, []);
};

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[clamp(20rem,50dvh,40rem)]">
      <div className="h-6 w-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
    </div>
  );
}

function App() {
  usePreloadRoutes();
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <MarketStreamProvider>
          <TooltipProvider>
            <BrowserRouter>
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Navigate to="/trade/btc" replace />} />
                    <Route path="/trade" element={<Navigate to="/trade/btc" replace />} />
                    <Route path="/trade/:symbol" element={<AssetDetail />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
              </Layout>
            </BrowserRouter>
          </TooltipProvider>
        </MarketStreamProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
