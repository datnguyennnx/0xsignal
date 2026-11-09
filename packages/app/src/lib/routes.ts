import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { matchPath } from "react-router";
import { AssetDetailSkeleton } from "@/components/asset-detail-skeleton";

type RoutePage = LazyExoticComponent<ComponentType>;

export interface RouteRecord {
  path: string;
  /** Title before the shared ` | 0xsignal` suffix. Omit when the page owns the title. */
  title?: string;
  navLabel?: string;
  authExempt?: boolean;
  lazy?: RoutePage;
  /** Route-shaped skeleton for the chunk window; `RouteFallback` reads it by identity. */
  fallback?: ComponentType;
  redirectTo?: string;
  /** `bare` renders outside the main layout; omitted means inside it. */
  shell?: "bare";
  errorBoundary?: boolean;
}

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

export const ROUTES: RouteRecord[] = [
  {
    path: "/login",
    title: "Welcome back",
    authExempt: true,
    shell: "bare",
    lazy: LoginPage,
    errorBoundary: true,
  },
  { path: "/auth/callback", authExempt: true, shell: "bare", lazy: AuthCallbackPage },

  { path: "/", redirectTo: "/trade/BTC" },
  { path: "/trade", redirectTo: "/trade/BTC", navLabel: "Trade" },
  { path: "/trade/:base/:quote", lazy: AssetDetail, fallback: AssetDetailSkeleton },
  { path: "/trade/:symbol", lazy: AssetDetail, fallback: AssetDetailSkeleton },
  { path: "/portfolio", title: "Portfolio", navLabel: "Portfolio", lazy: PortfolioPage },
  { path: "/whales", title: "Whales", navLabel: "Whales", lazy: WhalesPage },
  { path: "/whales/:address", title: "Whale", lazy: WhaleDetailPage },
  { path: "/calendar", title: "Calendar", navLabel: "Calendar", lazy: CalendarPage },
  { path: "/settings", title: "Settings", lazy: SettingsPage },
  { path: "*", title: "Not Found", lazy: NotFoundPage },
];

export const NAV_ROUTES = ROUTES.filter((route) => route.navLabel !== undefined);

export function isAuthExemptPath(pathname: string): boolean {
  return ROUTES.some((route) => route.authExempt === true && route.path === pathname);
}

/** `undefined` means the matched page owns its title (or the route sets none). */
export function titleForPath(pathname: string): string | undefined {
  const exact = ROUTES.find(
    (route) =>
      route.path !== "*" &&
      route.title !== undefined &&
      matchPath({ path: route.path, end: true }, pathname) !== null,
  );
  if (exact !== undefined) return exact.title;

  const known = ROUTES.some(
    (route) => route.path !== "*" && matchPath({ path: route.path, end: true }, pathname) !== null,
  );
  return known ? undefined : ROUTES.find((route) => route.path === "*")?.title;
}
