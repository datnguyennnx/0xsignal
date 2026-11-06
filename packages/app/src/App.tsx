import { Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MainLayout } from "@/layouts/main-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { AppToasters } from "@/components/app-toasters";
import { usePreloadRoutes } from "@/lib/preload-routes";
import { ROUTES, titleForPath, type RouteRecord } from "@/lib/routes";
import { useAppStore } from "@/stores/use-app-store";
import { useAuthStore } from "@/stores/use-auth-store";

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[clamp(20rem,50dvh,40rem)]">
      <div className="h-6 w-6 border-2 border-foreground/25 rounded-full animate-spin" />
    </div>
  );
}

function RouteErrorFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh gap-4">
      <p className="text-foreground">Something went wrong loading this page.</p>
      <button
        type="button"
        className="inline-flex h-[var(--control-h-md)] items-center justify-center rounded-[var(--control-radius-md)] bg-primary px-[var(--control-px-md)] font-medium text-[length:var(--control-text-md)] text-primary-foreground transition-colors hover:bg-primary/80"
        onClick={() => {
          window.location.reload();
        }}
      >
        Reload
      </button>
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

function BareRoute({ record }: { record: RouteRecord }) {
  const Page = record.lazy;
  if (Page === undefined) return null;
  return (
    <Suspense fallback={<PageLoader />}>
      {record.errorBoundary === true ? (
        <RouteErrorBoundary>
          <Page />
        </RouteErrorBoundary>
      ) : (
        <Page />
      )}
    </Suspense>
  );
}

function MainRoute({ record }: { record: RouteRecord }) {
  if (record.redirectTo !== undefined) return <Navigate to={record.redirectTo} replace />;
  const Page = record.lazy;
  return Page === undefined ? null : <Page />;
}

function RouteTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const title = titleForPath(pathname);
    if (title !== undefined) document.title = `${title} | 0xsignal`;
  }, [pathname]);
  return null;
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
          <RouteTitle />
          <Routes>
            {/* All routes are public. Auth enforced only at POST /exchange/* request boundary. */}
            {ROUTES.filter((route) => route.shell === "bare").map((route) => (
              <Route key={route.path} path={route.path} element={<BareRoute record={route} />} />
            ))}
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
              {ROUTES.filter((route) => route.shell !== "bare").map((route) => (
                <Route key={route.path} path={route.path} element={<MainRoute record={route} />} />
              ))}
            </Route>
          </Routes>
          <AppToasters />
        </BrowserRouter>
      </TooltipProvider>
    </ErrorBoundary>
  );
}
