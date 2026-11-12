import type { ComponentType } from "react";
import { matchPath, redirect, type RouteObject } from "react-router";
import { RouteErrorFallback } from "@/components/error-boundary";
import { preloadChartChunk } from "@/features/chart/lib/preload-chart";
import {
  AssetHydrateFallback,
  AuthHydrateFallback,
  PageHydrateFallback,
} from "@/components/route-fallback";

/** A route page chunk, loaded only when the router first needs it. */
export interface LazyRouteComponent {
  Component: () => Promise<ComponentType>;
}

export interface RouteHandle {
  /** Title before the shared ` | 0xsignal` suffix. Omit when the page owns the title. */
  title?: string;
  /** Manifest page stem, used by the bundle census and preload registry. */
  chunk: string;
  /** Warms this record's chunk on link intent and at the idle preload. */
  preload: () => Promise<unknown>;
}

/** One source of truth for a route's path, chunk, fallback, title and preload. */
export interface RouteRecord {
  path: string;
  title?: string;
  navLabel?: string;
  authExempt?: boolean;
  redirectTo?: string;
  /** `bare` renders outside the main layout; omitted means inside it. */
  shell?: "bare";
  lazy?: LazyRouteComponent;
  hydrateFallback?: ComponentType;
  errorBoundary?: ComponentType;
  handle: RouteHandle;
}

interface RouteSpec extends Omit<
  RouteRecord,
  "handle" | "title" | "hydrateFallback" | "errorBoundary"
> {
  title?: string;
  chunk: string;
  preload?: () => Promise<unknown>;
  hydrateFallback?: ComponentType;
  errorBoundary?: ComponentType;
}

const loadAssetDetail = (): Promise<ComponentType> =>
  import("@/pages/asset-detail").then((m) => m.AssetDetail);

const AssetDetailRoute: LazyRouteComponent = { Component: loadAssetDetail };

/** `/trade` warms the page chunk and the chart it renders above the fold. */
const preloadTrade = (): Promise<unknown> => Promise.all([loadAssetDetail(), preloadChartChunk()]);

/** Both trade page paths render the same chunk, so they share one record spec. */
const TRADE_PAGE = {
  chunk: "asset-detail",
  lazy: AssetDetailRoute,
  preload: preloadTrade,
  hydrateFallback: AssetHydrateFallback,
};

function pageRoute(
  chunk: string,
  load: () => Promise<ComponentType>,
): { chunk: string; lazy: LazyRouteComponent; preload: () => Promise<unknown> } {
  return { chunk, lazy: { Component: load }, preload: load };
}

const PORTFOLIO = pageRoute("portfolio", () =>
  import("@/pages/portfolio").then((m) => m.PortfolioPage),
);
const CALENDAR = pageRoute("calendar", () =>
  import("@/pages/calendar").then((m) => m.CalendarPage),
);
const SETTINGS = pageRoute("settings", () =>
  import("@/pages/settings").then((m) => m.SettingsPage),
);
const WHALES = pageRoute("whales", () => import("@/pages/whales").then((m) => m.WhalesPage));
const WHALE_DETAIL = pageRoute("whale-detail", () =>
  import("@/pages/whale-detail").then((m) => m.WhaleDetailPage),
);
const LOGIN = pageRoute("login", () => import("@/pages/login").then((m) => m.LoginPage));
const AUTH_CALLBACK = pageRoute("auth/callback", () =>
  import("@/pages/auth-callback").then((m) => m.AuthCallbackPage),
);
const NOT_FOUND = pageRoute("not-found", () =>
  import("@/pages/not-found").then((m) => m.NotFoundPage),
);

function defineRoute(spec: RouteSpec): RouteRecord {
  const { chunk, title, preload, hydrateFallback, errorBoundary, lazy, ...rest } = spec;
  return {
    ...rest,
    ...(title === undefined ? {} : { title }),
    ...(lazy === undefined ? {} : { lazy }),
    hydrateFallback: hydrateFallback ?? PageHydrateFallback,
    errorBoundary: errorBoundary ?? RouteErrorFallback,
    handle: {
      ...(title === undefined ? {} : { title }),
      chunk,
      preload: preload ?? (() => (lazy === undefined ? Promise.resolve() : lazy.Component())),
    },
  };
}

export const ROUTES: RouteRecord[] = [
  defineRoute({
    path: "/login",
    title: "Welcome back",
    authExempt: true,
    shell: "bare",
    ...LOGIN,
    hydrateFallback: PageHydrateFallback,
  }),
  defineRoute({
    path: "/auth/callback",
    authExempt: true,
    shell: "bare",
    ...AUTH_CALLBACK,
    hydrateFallback: AuthHydrateFallback,
  }),

  defineRoute({
    path: "/trade",
    redirectTo: "/trade/BTC",
    navLabel: "Trade",
    chunk: TRADE_PAGE.chunk,
    preload: TRADE_PAGE.preload,
  }),
  defineRoute({ path: "/trade/:base/:quote", ...TRADE_PAGE }),
  defineRoute({ path: "/trade/:symbol", ...TRADE_PAGE }),
  defineRoute({ path: "/portfolio", title: "Portfolio", navLabel: "Portfolio", ...PORTFOLIO }),
  defineRoute({ path: "/whales", title: "Whales", navLabel: "Whales", ...WHALES }),
  defineRoute({ path: "/whales/:address", title: "Whale", ...WHALE_DETAIL }),
  defineRoute({ path: "/calendar", title: "Calendar", navLabel: "Calendar", ...CALENDAR }),
  defineRoute({ path: "/settings", title: "Settings", ...SETTINGS }),
  defineRoute({ path: "*", title: "Not Found", ...NOT_FOUND }),
];

export type NavRoute = RouteRecord & { navLabel: string };

export const NAV_ROUTES: NavRoute[] = ROUTES.filter(
  (route): route is NavRoute => route.navLabel !== undefined,
);

/** Longest matching record; redirect prefixes such as `/trade` win only on an exact path. */
export function matchRouteRecord(pathname: string): RouteRecord | undefined {
  let best: RouteRecord | undefined;
  for (const route of ROUTES) {
    if (matchPath({ path: route.path, end: false }, pathname) === null) continue;
    if (best === undefined || route.path.length > best.path.length) best = route;
  }
  return best;
}

export function isAuthExemptPath(pathname: string): boolean {
  return ROUTES.some((route) => route.authExempt === true && route.path === pathname);
}

function toRouteObject(record: RouteRecord): RouteObject {
  const { path, handle, redirectTo, lazy, hydrateFallback, errorBoundary } = record;
  const base = {
    path,
    handle,
    ...(hydrateFallback === undefined ? {} : { HydrateFallback: hydrateFallback }),
    ...(errorBoundary === undefined ? {} : { ErrorBoundary: errorBoundary }),
  };
  if (redirectTo !== undefined) {
    return { ...base, loader: () => redirect(redirectTo) };
  }
  return { ...base, ...(lazy === undefined ? {} : { lazy }) };
}

const mainRoutes = ROUTES.filter((record) => record.shell !== "bare");
const bareRoutes = ROUTES.filter((record) => record.shell === "bare");

/** One module promise for the whole shell: both layout routes await the same chunk. */
function importAppRouter() {
  return import("@/app-router");
}
let appRouterModule: ReturnType<typeof importAppRouter> | undefined;
const loadAppRouter = (): ReturnType<typeof importAppRouter> =>
  (appRouterModule ??= importAppRouter());

const RootLayoutRoute: LazyRouteComponent = {
  Component: () => loadAppRouter().then((m) => m.RootLayout),
};

const MainLayoutRoute: LazyRouteComponent = {
  Component: () => loadAppRouter().then((m) => m.MainLayoutRoute),
};

/** The data-router tree: a shared root shell, the main layout, and the bare branch. */
export const ROUTE_OBJECTS: RouteObject[] = [
  {
    path: "/",
    lazy: RootLayoutRoute,
    HydrateFallback: PageHydrateFallback,
    ErrorBoundary: RouteErrorFallback,
    children: [
      {
        lazy: MainLayoutRoute,
        children: [
          { index: true, loader: () => redirect("/trade/BTC") },
          ...mainRoutes.map((record) => toRouteObject(record)),
        ],
      },
      ...bareRoutes.map((record) => toRouteObject(record)),
    ],
  },
];
