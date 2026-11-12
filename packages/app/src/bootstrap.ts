import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { App } from "./App";
import { initAppearance } from "./lib/appearance";
import { prefetchCriticalQueries } from "./lib/preload-routes";
import { ROUTE_OBJECTS } from "./lib/routes";
import { installResumeResync } from "./lib/resume-resync";
import { initAppStore } from "./stores/use-app-store";

export function bootstrap(): void {
  initAppStore();
  initAppearance();
  installResumeResync();

  const router = createBrowserRouter(ROUTE_OBJECTS);
  const rootEl = document.querySelector<HTMLElement>("#root");
  if (rootEl === null) throw new Error("Root element #root not found");

  createRoot(rootEl).render(createElement(App, { router }));

  prefetchCriticalQueries(window.location.pathname);
}
