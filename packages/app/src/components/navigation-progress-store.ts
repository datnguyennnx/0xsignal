/** A chunk that never resolves must not leave the bar on screen forever. */
export const NAV_PROGRESS_MAX_MS = 8000;
/** Do not paint the bar for fast/cached navigations. */
export const NAV_PROGRESS_SHOW_DELAY_MS = 120;
/** Once painted, keep the bar up long enough to register as feedback. */
export const NAV_PROGRESS_MIN_VISIBLE_MS = 250;
/** Opacity transition used by the component when the bar leaves. */
export const NAV_PROGRESS_FADE_MS = 200;

type Listener = () => void;

let active = 0;
/** True while the bar is in the DOM (opaque or fading out). */
let visible = false;
/** True while the leave transition is running. */
let fading = false;
let shownAt = 0;

let showTimer: ReturnType<typeof setTimeout> | null = null;
let minVisibleTimer: ReturnType<typeof setTimeout> | null = null;
let fadeTimer: ReturnType<typeof setTimeout> | null = null;
let safetyTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

function clearTimer(timer: ReturnType<typeof setTimeout> | null): null {
  if (timer !== null) clearTimeout(timer);
  return null;
}

function disarmSafetyTimer(): void {
  safetyTimer = clearTimer(safetyTimer);
}

function clearShowTimer(): void {
  showTimer = clearTimer(showTimer);
}

function clearMinVisibleTimer(): void {
  minVisibleTimer = clearTimer(minVisibleTimer);
}

function clearFadeTimer(): void {
  fadeTimer = clearTimer(fadeTimer);
}

function armSafetyTimer(): void {
  disarmSafetyTimer();
  // render-path-allow: last-resort reset if a chunk never resolves; the route commit clears first
  safetyTimer = setTimeout(() => {
    safetyTimer = null;
    if (active === 0 && !visible) return;
    // Last resort: drop everything immediately rather than waiting on a fade.
    clearShowTimer();
    clearMinVisibleTimer();
    clearFadeTimer();
    active = 0;
    visible = false;
    fading = false;
    emit();
  }, NAV_PROGRESS_MAX_MS);
}

function startFade(): void {
  minVisibleTimer = null;
  if (!visible) return;
  fading = true;
  emit();
  clearFadeTimer();
  fadeTimer = setTimeout(() => {
    fadeTimer = null;
    visible = false;
    fading = false;
    emit();
  }, NAV_PROGRESS_FADE_MS);
}

function beginHide(): void {
  clearShowTimer();
  // Never painted: the navigation was fast enough to stay silent.
  if (!visible) return;
  // Already leaving: keep the existing schedule.
  if (fading || minVisibleTimer !== null) return;

  const elapsed = Date.now() - shownAt;
  const remaining = NAV_PROGRESS_MIN_VISIBLE_MS - elapsed;
  if (remaining <= 0) {
    startFade();
    return;
  }
  minVisibleTimer = setTimeout(startFade, remaining);
}

/** Reference-counted: several in-flight navigations keep one bar. */
export function showNavigationProgress(): void {
  const wasIdle = active === 0;
  active += 1;
  armSafetyTimer();
  if (!wasIdle) return;

  if (visible) {
    // Re-show during the leave transition: cancel it and paint opaque again.
    clearMinVisibleTimer();
    clearFadeTimer();
    fading = false;
    shownAt = Date.now();
    emit();
    return;
  }

  // Delay the first paint so cached/fast navigations never flash.
  clearShowTimer();
  showTimer = setTimeout(() => {
    showTimer = null;
    if (active === 0) return;
    visible = true;
    fading = false;
    shownAt = Date.now();
    emit();
  }, NAV_PROGRESS_SHOW_DELAY_MS);
}

export function hideNavigationProgress(): void {
  if (active === 0) return;
  active -= 1;
  if (active > 0) return;
  disarmSafetyTimer();
  beginHide();
}

/** Route commit: the destination rendered, so clear every outstanding show. */
export function clearNavigationProgress(): void {
  disarmSafetyTimer();
  if (active === 0) return;
  active = 0;
  beginHide();
}

/**
 * Unmount: drop every timer and the bar state without emitting. Safe to call
 * when already idle.
 */
export function disposeNavigationProgress(): void {
  clearShowTimer();
  clearMinVisibleTimer();
  clearFadeTimer();
  disarmSafetyTimer();
  active = 0;
  visible = false;
  fading = false;
}

export function subscribeNavigationProgress(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getNavigationProgressSnapshot(): boolean {
  return visible;
}

export function getNavigationProgressFading(): boolean {
  return fading;
}

type NavigationListener = (event: Event) => void;

export interface NavigationListenerTarget {
  addEventListener(type: string, listener: NavigationListener, options?: boolean): void;
  removeEventListener(type: string, listener: NavigationListener, options?: boolean): void;
}

function handleClick(event: Event): void {
  if (!(event instanceof MouseEvent)) return;
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest("a");
  if (!(anchor instanceof HTMLAnchorElement)) return;
  if (anchor.target !== "" && anchor.target !== "_self") return;
  if (anchor.hasAttribute("download")) return;

  const href = anchor.getAttribute("href");
  if (href === null || href === "" || href.startsWith("#")) return;

  const url = new URL(anchor.href);
  if (url.origin !== window.location.origin) return;
  if (url.pathname === window.location.pathname && url.search === window.location.search) return;

  showNavigationProgress();
}

function handlePopState(): void {
  showNavigationProgress();
}

/**
 * Attach the same-origin interception once. Returns the detach function so the
 * component's unmount removes exactly the listeners it added.
 */
export function attachNavigationProgressListeners(
  document: NavigationListenerTarget,
  window: NavigationListenerTarget,
): () => void {
  document.addEventListener("click", handleClick, true);
  window.addEventListener("popstate", handlePopState);
  return () => {
    document.removeEventListener("click", handleClick, true);
    window.removeEventListener("popstate", handlePopState);
  };
}
