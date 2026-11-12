import { useEffect } from "react";
import { Outlet, ScrollRestoration, useMatches } from "react-router";
import { NavigationProgress } from "@/components/navigation-progress";
import { MainLayout } from "@/layouts/main-layout";
import { usePreloadRoutes } from "@/lib/preload-routes";

function titleOf(handle: unknown): string | undefined {
  if (typeof handle !== "object" || handle === null || !("title" in handle)) return undefined;
  const value = handle.title;
  return typeof value === "string" ? value : undefined;
}

/** One title effect for the whole app; pages with dynamic titles own them afterwards. */
function DocumentTitle() {
  const matches = useMatches();
  let title: string | undefined;
  for (const match of matches) {
    const matched = titleOf(match.handle);
    if (matched !== undefined) title = matched;
  }

  useEffect(() => {
    if (title !== undefined) document.title = `${title} | 0xsignal`;
  }, [title]);

  return null;
}

/** Shared root: title, progress and scroll restoration wrap both layout branches. */
export function RootLayout() {
  usePreloadRoutes();
  return (
    <>
      <DocumentTitle />
      <NavigationProgress />
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

export function MainLayoutRoute() {
  return (
    <MainLayout>
      <Outlet />
    </MainLayout>
  );
}
