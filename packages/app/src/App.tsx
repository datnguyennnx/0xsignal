import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { MainLayout } from "@/layouts/main-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/sonner";
import { queryKeys } from "@/lib/query-keys";
import { queryClient } from "@/lib/query-client";
import { api } from "@/services/api";
import { useAppStore } from "@/stores/use-app-store";
import { useAuthStore } from "@/stores/use-auth-store";

const AssetDetail = lazy(() =>
  import("@/pages/asset-detail").then((m) => ({ default: m.AssetDetail })),
);
const NotFoundPage = lazy(() =>
  import("@/pages/not-found").then((m) => ({ default: m.NotFoundPage })),
);
const PortfolioPage = lazy(() =>
  import("@/pages/portfolio").then((m) => ({ default: m.PortfolioPage })),
);
const CalendarPage = lazy(() =>
  import("@/pages/calendar").then((m) => ({ default: m.CalendarPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/settings").then((m) => ({ default: m.SettingsPage })),
);
const WhalesPage = lazy(() => import("@/pages/whales").then((m) => ({ default: m.WhalesPage })));
const WhaleDetailPage = lazy(() =>
  import("@/pages/whale-detail").then((m) => ({ default: m.WhaleDetailPage })),
);
const LoginPage = lazy(() => import("@/pages/login").then((m) => ({ default: m.LoginPage })));
const AuthCallbackPage = lazy(() =>
  import("@/pages/auth-callback").then((m) => ({ default: m.AuthCallbackPage })),
);

/** Schema version guard — now delegated to useAppStore.checkSchemaVersion() */

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
      import("@/pages/whales");
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
    <div className="flex flex-col items-center justify-center min-h-dvh gap-4">
      <p className="text-foreground">Something went wrong loading this page.</p>
      <Button onClick={() => window.location.reload()}>Reload</Button>
    </div>
  );
}

function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname} fallback={<RouteErrorFallback />}>
      {children}
    </ErrorBoundary>
  );
}

export function App() {
  const checkSchemaVersion = useAppStore((s) => s.checkSchemaVersion);
  useEffect(() => {
    checkSchemaVersion();
  }, [checkSchemaVersion]);
  useEffect(() => {
    const cancel = useAuthStore.getState().initialize();
    return cancel;
  }, []);
  usePreloadRoutes();
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            {/* All routes are public. Auth enforced only at POST /exchange/* request boundary. */}
            <Route
              path="/login"
              element={
                <Suspense fallback={<PageLoader />}>
                  <RouteErrorBoundary>
                    <LoginPage />
                  </RouteErrorBoundary>
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
                    <RouteErrorBoundary>
                      <Outlet />
                    </RouteErrorBoundary>
                  </Suspense>
                </MainLayout>
              }
            >
              <Route path="/" element={<Navigate to="/trade/BTC" replace />} />
              <Route path="/trade" element={<Navigate to="/trade/BTC" replace />} />
              <Route path="/trade/:base/:quote" element={<AssetDetail />} />
              <Route path="/trade/:symbol" element={<AssetDetail />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/whales" element={<WhalesPage />} />
              <Route path="/whales/:address" element={<WhaleDetailPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
          <Toaster />
        </BrowserRouter>
      </TooltipProvider>
    </ErrorBoundary>
  );
}
