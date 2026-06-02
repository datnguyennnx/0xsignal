/**
 * @overview Main App Component
 * Sets up routing, theme, and backend market-stream context.
 *
 * @performance
 * - Lazy loads heavy routes (AssetDetail, TradingChart)
 * - Preloads critical routes 2s after mount to not block initial render
 * - Uses Suspense for streaming SSR-like experience
 */
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/core/providers/theme-provider";
import { AuthProvider } from "@/core/providers/auth-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MarketStreamProvider } from "@/features/trade/contexts/market-stream-context";
import { MainLayout } from "@/layouts/main-layout";
import { ErrorBoundary } from "@/components/error-boundary";

import { queryKeys } from "@/lib/query/query-keys";
import { queryClient } from "@/lib/query/client";
import { api } from "@/services/api";

const AssetDetail = lazy(() =>
  import("@/pages/asset-detail").then((m) => ({ default: m.AssetDetail }))
);
const NotFoundPage = lazy(() =>
  import("@/pages/not-found").then((m) => ({ default: m.NotFoundPage }))
);
const PortfolioPage = lazy(() =>
  import("@/pages/portfolio").then((m) => ({ default: m.PortfolioPage }))
);
const SettingsPage = lazy(() =>
  import("@/pages/settings").then((m) => ({ default: m.SettingsPage }))
);
const LoginPage = lazy(() => import("@/pages/login").then((m) => ({ default: m.LoginPage })));
const AuthCallbackPage = lazy(() =>
  import("@/pages/auth-callback").then((m) => ({ default: m.AuthCallbackPage }))
);

/** Keep in sync with backend MARKET_SCHEMA_VERSION (cache.ts). Bump when payload shape changes. */
const FRONTEND_MARKET_SCHEMA_VERSION = 2;
const MARKET_SCHEMA_KEY = "0xsignal_market_schema_version";

const useSchemaVersionGuard = () => {
  useEffect(() => {
    const stored = localStorage.getItem(MARKET_SCHEMA_KEY);
    if (stored !== String(FRONTEND_MARKET_SCHEMA_VERSION)) {
      queryClient.removeQueries({ queryKey: queryKeys.marketData.all });
      queryClient.removeQueries({ queryKey: queryKeys.chart.all });
      queryClient.invalidateQueries();
      localStorage.setItem(MARKET_SCHEMA_KEY, String(FRONTEND_MARKET_SCHEMA_VERSION));
    }
  }, []);
};

const usePreloadRoutes = () => {
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.marketData.markets(),
      queryFn: () => api.getMarkets(),
      staleTime: 5 * 60 * 1000,
    });

    const preloadTimer = setTimeout(() => {
      import("@/pages/asset-detail");
      import("@/pages/portfolio");
      import("@/features/chart/trading-chart");
    }, 2000);
    return () => clearTimeout(preloadTimer);
  }, []);
};

import { useAuth } from "@/core/providers/auth-context";

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[clamp(20rem,50dvh,40rem)]">
      <div className="h-6 w-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return <PageLoader />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return <PageLoader />;
  }
  if (isAuthenticated) {
    return <Navigate to="/trade/BTC" replace />;
  }
  return <>{children}</>;
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

function App() {
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
                  {/* Public routes — no app chrome */}
                  <Route
                    path="/login"
                    element={
                      <PublicRoute>
                        <Suspense fallback={<PageLoader />}>
                          <ErrorBoundary fallback={<RouteErrorFallback />}>
                            <LoginPage />
                          </ErrorBoundary>
                        </Suspense>
                      </PublicRoute>
                    }
                  />
                  <Route
                    path="/auth/callback"
                    element={
                      <PublicRoute>
                        <Suspense fallback={<PageLoader />}>
                          <AuthCallbackPage />
                        </Suspense>
                      </PublicRoute>
                    }
                  />
                  {/* Authenticated routes — inside MainLayout */}
                  <Route
                    path="/*"
                    element={
                      <ProtectedRoute>
                        <MainLayout>
                          <Suspense fallback={<PageLoader />}>
                            <ErrorBoundary fallback={<RouteErrorFallback />}>
                              <Routes>
                                <Route path="/" element={<Navigate to="/trade/BTC" replace />} />
                                <Route
                                  path="/trade"
                                  element={<Navigate to="/trade/BTC" replace />}
                                />
                                <Route path="/trade/:base/:quote" element={<AssetDetail />} />
                                <Route path="/trade/:symbol" element={<AssetDetail />} />
                                <Route path="/portfolio" element={<PortfolioPage />} />
                                <Route path="/settings" element={<SettingsPage />} />
                                <Route path="*" element={<NotFoundPage />} />
                              </Routes>
                            </ErrorBoundary>
                          </Suspense>
                        </MainLayout>
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </MarketStreamProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
