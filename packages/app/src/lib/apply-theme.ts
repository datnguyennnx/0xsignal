type ViewTransitionLike = { finished: Promise<unknown> };

const VIEW_TRANSITION_ATTR = "data-view-transition";

export type ResolvedTheme = "dark" | "light";

function writeRootTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function isViewTransition(value: unknown): value is ViewTransitionLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "finished" in value &&
    value.finished instanceof Promise
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The only DOM write for a palette swap. `commit` carries the React state that
 * drives the toggle, so the snapshots and the icon agree on one theme.
 *
 * The transition start stays local rather than reusing `withViewTransition`:
 * the store is eager, and pulling the lazy overlay helper into the entry chunk
 * adds a hop to a route's chunk chain.
 *
 * `writeRootTheme` runs synchronously inside the transition callback, so the
 * new snapshot is painted from the new palette even though React commits the
 * state update afterwards; every theme consumer reads that new state, never the
 * old one.
 */
export function applyTheme(
  theme: ResolvedTheme,
  commit: () => void,
  options?: { animate?: boolean },
): void {
  if (typeof document === "undefined") {
    commit();
    return;
  }

  const update = () => {
    commit();
    writeRootTheme(theme);
  };

  const start: unknown = Reflect.get(document, "startViewTransition");
  if (options?.animate === false || prefersReducedMotion() || typeof start !== "function") {
    update();
    return;
  }

  const root = document.documentElement;
  root.dataset.viewTransition = "active";
  const transition: unknown = Reflect.apply(start, document, [update]);
  const finished = isViewTransition(transition) ? transition.finished : Promise.resolve();
  void finished
    .catch(() => {})
    .finally(() => {
      root.removeAttribute(VIEW_TRANSITION_ATTR);
    });
}
