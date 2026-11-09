import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useLocation } from "react-router";
import {
  attachNavigationProgressListeners,
  clearNavigationProgress,
  disposeNavigationProgress,
  getNavigationProgressFading,
  getNavigationProgressSnapshot,
  NAV_PROGRESS_FADE_MS,
  subscribeNavigationProgress,
} from "@/components/navigation-progress-store";

function getServerSnapshot(): boolean {
  return false;
}

export function NavigationProgress(): ReactNode {
  const { pathname, search } = useLocation();
  const visible = useSyncExternalStore(
    subscribeNavigationProgress,
    getNavigationProgressSnapshot,
    getServerSnapshot,
  );
  const fading = useSyncExternalStore(
    subscribeNavigationProgress,
    getNavigationProgressFading,
    getServerSnapshot,
  );

  useEffect(() => {
    const detach = attachNavigationProgressListeners(document, window);
    return () => {
      detach();
      disposeNavigationProgress();
    };
  }, []);

  // The route committed: React painted the destination, so the bar has done its
  // job. The store still honours the minimum-visible window before fading out.
  useEffect(() => {
    // A commit is exactly a path/search change; read them so the deps are meaningful.
    if (pathname !== "" || search !== "") clearNavigationProgress();
  }, [pathname, search]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      data-navigation-progress
      data-state={fading ? "fading" : "visible"}
      className={`pointer-events-none fixed inset-x-0 top-0 z-(--z-bar) h-0.5 bg-info transition-opacity ease-out ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${NAV_PROGRESS_FADE_MS}ms` }}
    />
  );
}
