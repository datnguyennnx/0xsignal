// This module owns all root-font-size measurement; do not read it elsewhere.
const FALLBACK_ROOT_FONT_SIZE_PX = 16;

let epoch = 0;
let cache: { value: number; epoch: number } | null = null;

function readRootFontSizePx(): number {
  if (typeof document === "undefined") return FALLBACK_ROOT_FONT_SIZE_PX;
  try {
    const raw = getComputedStyle(document.documentElement).fontSize;
    const parsed = Number(raw.trim().replace(/px$/, ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_ROOT_FONT_SIZE_PX;
  } catch {
    return FALLBACK_ROOT_FONT_SIZE_PX;
  }
}

export function getRootFontSizePx(): number {
  if (cache !== null && cache.epoch === epoch) return cache.value;
  const value = readRootFontSizePx();
  cache = { value, epoch };
  return value;
}

export function remToPx(rem: number): number {
  if (!Number.isFinite(rem)) return 0;
  return rem * getRootFontSizePx();
}

const subscribers = new Set<() => void>();
let teardown: (() => void) | null = null;

function refresh(): void {
  const previous = getRootFontSizePx();
  const next = readRootFontSizePx();
  if (next !== previous) {
    epoch += 1;
    cache = { value: next, epoch };
  }
  for (const callback of subscribers) callback();
}

function attachSharedListeners(): () => void {
  const onResize = () => {
    refresh();
  };
  window.addEventListener("resize", onResize);

  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(() => {
      refresh();
    });
    observer.observe(document.documentElement);
  }

  return () => {
    window.removeEventListener("resize", onResize);
    observer?.disconnect();
  };
}

export function subscribeRootFontSize(callback: () => void): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  subscribers.add(callback);
  teardown ??= attachSharedListeners();

  return () => {
    if (!subscribers.delete(callback)) return;
    if (subscribers.size === 0 && teardown !== null) {
      teardown();
      teardown = null;
    }
  };
}
