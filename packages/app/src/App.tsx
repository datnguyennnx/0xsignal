import { Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MainLayout } from "@/layouts/main-layout";
import { ErrorBoundary, PageLoader } from "@/components/error-boundary";
import { AppToasters } from "@/components/app-toasters";
import { usePreloadRoutes } from "@/lib/preload-routes";
import { ROUTES, titleForPath, type RouteRecord } from "@/lib/routes";
import { useAppStore } from "@/stores/use-app-store";
import { useAuthStore } from "@/stores/use-auth-store";

function RouteErrorFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh gap-4">
      <p className="text-foreground">Something went wrong loading this page.</p>
      <button
        type="button"
        className="inline-flex h-control items-center justify-center rounded-control bg-info px-(--control-px) font-medium type-control text-primary-foreground transition-colors hover:bg-info/80"
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
  if (Page === undefined) return null;
  // A route may reserve its real layout while the chunk loads instead of a spinner.
  const Fallback = record.fallback;
  return (
    <Suspense fallback={Fallback === undefined ? <PageLoader /> : <Fallback />}>
      <Page />
    </Suspense>
  );
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
                  {/* Each route owns its Suspense + fallback; a second whole-route
                      boundary here would blank the layout instead of painting the
                      route skeleton. */}
                  <RouteErrorBoundary>
                    <Outlet />
                  </RouteErrorBoundary>
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
