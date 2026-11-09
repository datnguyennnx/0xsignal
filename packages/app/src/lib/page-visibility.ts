/**
 * Page-visibility helpers.
 *
 * `onPageVisibilityChange` gives one `visibilitychange` listener per
 * subscriber. The lifecycle helpers (`onPageResume` / `onPageSuspend`) span
 * several events that different browsers expose; they share one native
 * listener per event type while at least one subscriber needs it, and detach
 * it when the last subscriber leaves.
 *
 * Everything is SSR-safe: without a `document` the page is treated as visible
 * and every subscription returns a no-op unsubscribe.
 */

type PageVisibilityListener = (hidden: boolean) => void;
type PageLifecycleListener = () => void;

/** Two lifecycle sources firing in the same burst produce one notification. */
const RESUME_DEDUPE_MS = 250;

/** True only in a browser tab whose document is currently hidden. */
export function isPageHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

/** Subscribe to visibility transitions; returns an idempotent unsubscribe. */
export function onPageVisibilityChange(listener: PageVisibilityListener): () => void {
  if (typeof document === "undefined" || typeof document.addEventListener !== "function") {
    return () => {};
  }

  const handler = (): void => {
    listener(document.visibilityState === "hidden");
  };
  document.addEventListener("visibilitychange", handler);

  return () => {
    document.removeEventListener("visibilitychange", handler);
  };
}

interface PageSignal {
  readonly listeners: Map<number, PageLifecycleListener>;
  lastEmitMs: number;
}

interface PageEventTarget {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

interface PageEventBinding {
  readonly type: string;
  readonly resolveTarget: () => PageEventTarget | null;
  readonly dispatch: () => void;
  count: number;
  attachedTarget: PageEventTarget | null;
}

const createSignal = (): PageSignal => ({
  listeners: new Map(),
  lastEmitMs: Number.NEGATIVE_INFINITY,
});

const resumeSignal = createSignal();
const suspendSignal = createSignal();

let nextListenerId = 0;

/** Notify every current subscriber once per burst, even across event sources. */
const emitSignal = (signal: PageSignal): void => {
  if (signal.listeners.size === 0) return;

  const now = Date.now();
  if (now - signal.lastEmitMs < RESUME_DEDUPE_MS) return;

  signal.lastEmitMs = now;
  for (const listener of Array.from(signal.listeners.values())) listener();
};

const resolveDocumentTarget = (): PageEventTarget | null =>
  typeof document !== "undefined" && typeof document.addEventListener === "function"
    ? document
    : null;

const resolveWindowTarget = (): PageEventTarget | null =>
  typeof window !== "undefined" && typeof window.addEventListener === "function" ? window : null;

/**
 * A single native listener per event type, reference-counted by the number of
 * lifecycle subscriptions that need it.
 */
const attachBinding = (binding: PageEventBinding): void => {
  binding.count += 1;
  if (binding.attachedTarget) return;

  const target = binding.resolveTarget();
  if (!target) return;

  target.addEventListener(binding.type, binding.dispatch);
  binding.attachedTarget = target;
};

const detachBinding = (binding: PageEventBinding): void => {
  binding.count = Math.max(0, binding.count - 1);
  if (binding.count > 0 || !binding.attachedTarget) return;

  binding.attachedTarget.removeEventListener(binding.type, binding.dispatch);
  binding.attachedTarget = null;
};

const visibilityBinding: PageEventBinding = {
  type: "visibilitychange",
  resolveTarget: resolveDocumentTarget,
  dispatch: () => {
    if (isPageHidden()) emitSignal(suspendSignal);
    else emitSignal(resumeSignal);
  },
  count: 0,
  attachedTarget: null,
};

const pageshowBinding: PageEventBinding = {
  type: "pageshow",
  resolveTarget: resolveWindowTarget,
  dispatch: () => {
    emitSignal(resumeSignal);
  },
  count: 0,
  attachedTarget: null,
};

const pagehideBinding: PageEventBinding = {
  type: "pagehide",
  resolveTarget: resolveWindowTarget,
  dispatch: () => {
    emitSignal(suspendSignal);
  },
  count: 0,
  attachedTarget: null,
};

const resumeBinding: PageEventBinding = {
  type: "resume",
  resolveTarget: resolveDocumentTarget,
  dispatch: () => {
    emitSignal(resumeSignal);
  },
  count: 0,
  attachedTarget: null,
};

const freezeBinding: PageEventBinding = {
  type: "freeze",
  resolveTarget: resolveDocumentTarget,
  dispatch: () => {
    emitSignal(suspendSignal);
  },
  count: 0,
  attachedTarget: null,
};

const RESUME_BINDINGS: readonly PageEventBinding[] = [
  visibilityBinding,
  pageshowBinding,
  resumeBinding,
];

const SUSPEND_BINDINGS: readonly PageEventBinding[] = [
  visibilityBinding,
  pagehideBinding,
  freezeBinding,
];

const subscribeToLifecycle = (
  signal: PageSignal,
  bindings: readonly PageEventBinding[],
  listener: PageLifecycleListener,
): (() => void) => {
  if (typeof document === "undefined") return () => {};

  const id = nextListenerId;
  nextListenerId += 1;
  signal.listeners.set(id, listener);
  for (const binding of bindings) attachBinding(binding);

  let active = true;
  return () => {
    if (!active) return;
    active = false;

    signal.listeners.delete(id);
    for (const binding of bindings) detachBinding(binding);
    if (signal.listeners.size === 0) signal.lastEmitMs = Number.NEGATIVE_INFINITY;
  };
};

/** Fires when the page becomes visible, on `pageshow`, or on `resume`. */
export function onPageResume(listener: PageLifecycleListener): () => void {
  return subscribeToLifecycle(resumeSignal, RESUME_BINDINGS, listener);
}

/** Fires when the page becomes hidden, on `pagehide`, or on `freeze`. */
export function onPageSuspend(listener: PageLifecycleListener): () => void {
  return subscribeToLifecycle(suspendSignal, SUSPEND_BINDINGS, listener);
}

/** True when Chromium discarded the page and restored it from the back/forward cache. */
export function wasPageDiscarded(): boolean {
  if (typeof document === "undefined") return false;
  return (document as Document & { wasDiscarded?: boolean }).wasDiscarded === true;
}
