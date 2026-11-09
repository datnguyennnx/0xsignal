import { initAppearance } from "./lib/appearance";
import { prefetchCriticalQueries } from "./lib/preload-routes";
import { installResumeResync } from "./lib/resume-resync";
import { initAppStore } from "./stores/use-app-store";

export function bootstrap(render: () => void): void {
  initAppStore();
  initAppearance();
  installResumeResync();

  render();

  prefetchCriticalQueries(window.location.pathname);
}
