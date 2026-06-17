import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { ThemeProvider } from "@/core/providers/theme-provider";
import { AuthProvider } from "@/core/providers/auth-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MarketStreamProvider } from "@/features/trade/contexts/market-stream-context";
import { MainLayout } from "@/layouts/main-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/sonner";
import { queryKeys } from "@/lib/query-keys";
import { queryClient } from "@/lib/query-client";
import { api } from "@/services/api";

const AssetDetail = lazy(() =>
  import("@/pages/asset-detail").then((m) => ({ default: m.AssetDetail })),
);
const NotFoundPage = lazy(() =>
  import("@/pages/not-found").then((m) => ({ default: m.NotFoundPage })),
);
const PortfolioPage = lazy(() =>
  import("@/pages/portfolio").then((m) => ({ default: m.PortfolioPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/settings").then((m) => ({ default: m.SettingsPage })),
);
const LoginPage = lazy(() => import("@/pages/login").then((m) => ({ default: m.LoginPage })));
const AuthCallbackPage = lazy(() =>
  import("@/pages/auth-callback").then((m) => ({ default: m.AuthCallbackPage })),
);

/** Keep in sync with backend MARKET_SCHEMA_VERSION (cache.ts). Bump when payload shape changes. */
const FRONTEND_MARKET_SCHEMA_VERSION = 2;
const MARKET_SCHEMA_KEY = "0xsignal_market_schema_version";

const useSchemaVersionGuard = () => {
  useEffect(() => {
    const stored = localStorage.getItem(MARKET_SCHEMA_KEY);
    if (stored !== String(FRONTEND_MARKET_SCHEMA_VERSION)) {
      queryClient.removeQueries({ queryKey: queryKeys.market.all });
      queryClient.removeQueries({ queryKey: ["market", "candles"] });
      queryClient.invalidateQueries();
      localStorage.setItem(MARKET_SCHEMA_KEY, String(FRONTEND_MARKET_SCHEMA_VERSION));
    }
  }, []);
};

const usePreloadRoutes = () => {
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.market.meta(),
      queryFn: () => api.getMarkets(),
      staleTime: 5 * 60 * 1000,
    });

    const preloadTimer = setTimeout(() => {
      import("@/pages/asset-detail");
      import("@/pages/portfolio");
      import("@/features/chart/components/trading-chart");
    }, 2000);
    return () => clearTimeout(preloadTimer);
  }, []);
};

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[clamp(20rem,50dvh,40rem)]">
      <div className="h-6 w-6 border-2 border-foreground/20 rounded-full animate-spin" />
    </div>
  );
}

function RouteErrorFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <p className="text-foreground">Something went wrong loading this page.</p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
      >
        Reload
      </button>
    </div>
  );
}

export function App() {
  useSchemaVersionGuard();
  usePreloadRoutes();
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <AuthProvider>
          <MarketStreamProvider>
            <TooltipProvider>
              <BrowserRouter>
                <Routes>
                  {/* All routes are public. Auth enforced only at POST /exchange/* request boundary. */}
                  <Route
                    path="/login"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <ErrorBoundary fallback={<RouteErrorFallback />}>
                          <LoginPage />
                        </ErrorBoundary>
                      </Suspense>
                    }
                  />
                  <Route
                    path="/auth/callback"
                    element={
                      <Suspense fallback={<PageLoader />}>
                        <AuthCallbackPage />
                      </Suspense>
                    }
                  />
                  <Route
                    element={
                      <MainLayout>
                        <Suspense fallback={<PageLoader />}>
                          <ErrorBoundary fallback={<RouteErrorFallback />}>
                            <Outlet />
                          </ErrorBoundary>
                        </Suspense>
                      </MainLayout>
                    }
                  >
                    <Route path="/" element={<Navigate to="/trade/BTC" replace />} />
                    <Route path="/trade" element={<Navigate to="/trade/BTC" replace />} />
                    <Route path="/trade/:base/:quote" element={<AssetDetail />} />
                    <Route path="/trade/:symbol" element={<AssetDetail />} />
                    <Route path="/portfolio" element={<PortfolioPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Routes>
                <Toaster />
              </BrowserRouter>
            </TooltipProvider>
          </MarketStreamProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
