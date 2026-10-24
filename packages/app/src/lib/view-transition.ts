/** Local subset of the View Transitions API; avoids depending on the TS lib. */
type ViewTransitionLike = { finished: Promise<unknown> };

/** Root flag CSS reads to suppress a component's own enter animation. */
const VIEW_TRANSITION_ATTR = "data-view-transition";

function isViewTransition(value: unknown): value is ViewTransitionLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "finished" in value &&
    value.finished instanceof Promise
  );
}

function viewTransitionStarter(): ((update: () => void) => ViewTransitionLike) | undefined {
  if (typeof document === "undefined") return undefined;
  const start: unknown = Reflect.get(document, "startViewTransition");
  if (typeof start !== "function") return undefined;
  return (update: () => void) => {
    const transition: unknown = Reflect.apply(start, document, [update]);
    return isViewTransition(transition) ? transition : { finished: Promise.resolve() };
  };
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Run `update` in a view transition; synchronously when unsupported or reduced. */
export function withViewTransition(
  update: () => void,
  options?: { reducedMotion?: boolean },
): void {
  const start = viewTransitionStarter();
  const reduced = options?.reducedMotion ?? prefersReducedMotion();
  if (start === undefined || typeof document === "undefined" || reduced) {
    update();
    return;
  }

  const root = document.documentElement;
  root.dataset.viewTransition = "active";
  const transition = start(update);
  void transition.finished
    .catch(() => {})
    .finally(() => {
      root.removeAttribute(VIEW_TRANSITION_ATTR);
    });
}
