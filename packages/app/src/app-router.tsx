import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { MainLayout } from "@/layouts/main-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorState } from "@/components/error-state";
import { NavigationProgress } from "@/components/navigation-progress";
import { RouteFallback } from "@/components/route-fallback";
import { ROUTES, titleForPath, type RouteRecord } from "@/lib/routes";
import { routeMotionKey } from "@/lib/route-motion";
import { pickErrorQuip } from "@/lib/error-quips";

export function RouteErrorFallback() {
  const [quip] = useState(() => pickErrorQuip());
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center">
      <ErrorState
        title="Something went wrong"
        description={quip}
        retryLabel="Try again"
        retryAction={() => {
          window.location.reload();
        }}
      />
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
  const { pathname } = useLocation();
  const Page = record.lazy;
  if (Page === undefined) return null;
  return (
    <div key={routeMotionKey(record)} className="content-enter min-h-dvh">
      <Suspense fallback={<RouteFallback pathname={pathname} />}>
        {record.errorBoundary === true ? (
          <RouteErrorBoundary>
            <Page />
          </RouteErrorBoundary>
        ) : (
          <Page />
        )}
      </Suspense>
    </div>
  );
}

function MainRoute({ record }: { record: RouteRecord }) {
  const { pathname } = useLocation();
  if (record.redirectTo !== undefined) return <Navigate to={record.redirectTo} replace />;
  const Page = record.lazy;
  if (Page === undefined) return null;
  return (
    <div
      key={routeMotionKey(record)}
      className="content-enter flex flex-1 min-h-0 min-w-0 flex-col"
    >
      <Suspense fallback={<RouteFallback pathname={pathname} />}>
        <Page />
      </Suspense>
    </div>
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

export function AppRouter() {
  return (
    <>
      <RouteTitle />
      <NavigationProgress />
      <Routes>
        {ROUTES.filter((route) => route.shell === "bare").map((route) => (
          <Route key={route.path} path={route.path} element={<BareRoute record={route} />} />
        ))}
        <Route
          element={
            <MainLayout>
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
    </>
  );
}
