/**
 * A single `ResizeObserver` for the whole app. Element-level observers allocate a
 * native observer each; this fans one observer out to per-element callbacks and
 * drops the element when its last listener detaches.
 */

export type ResizeListener = (entry: ResizeObserverEntry) => void;

const listeners = new Map<Element, Set<ResizeListener>>();
let observer: ResizeObserver | null = null;

function ensureObserver(): ResizeObserver | null {
  if (observer !== null) return observer;
  if (typeof ResizeObserver === "undefined") return null;
  observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const set = listeners.get(entry.target);
      if (set === undefined) continue;
      for (const listener of set) listener(entry);
    }
  });
  return observer;
}

export function observeResize(element: Element, listener: ResizeListener): () => void {
  const shared = ensureObserver();
  if (shared === null) return () => {};

  let set = listeners.get(element);
  if (set === undefined) {
    set = new Set();
    listeners.set(element, set);
    shared.observe(element);
  }
  set.add(listener);

  return () => {
    const current = listeners.get(element);
    if (current === undefined || !current.delete(listener)) return;
    if (current.size > 0) return;
    listeners.delete(element);
    observer?.unobserve(element);
  };
}
