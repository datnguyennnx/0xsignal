const AUTO_SCROLL_EDGE_PX = 48;
const AUTO_SCROLL_MAX_VELOCITY = 18;

export function effectiveDelta(
  clientY: number,
  startY: number,
  scrollTop: number,
  startScrollTop: number,
  rowPitch: number,
): number {
  const pitch = Math.max(1, rowPitch);
  return Math.round((clientY - startY + (scrollTop - startScrollTop)) / pitch);
}

function isScrollableY(el: HTMLElement): boolean {
  if (el.scrollHeight <= el.clientHeight) return false;
  const overflowY = getComputedStyle(el).overflowY;
  return overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay";
}

export function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  if (el === null || !el.isConnected) return null;

  for (let node = el.parentElement; node !== null; node = node.parentElement) {
    if (isScrollableY(node)) return node;
  }

  const scrolling = el.ownerDocument.scrollingElement;
  if (scrolling !== null && scrolling instanceof HTMLElement && isScrollableY(scrolling)) {
    return scrolling;
  }
  return null;
}

export function resolveAutoScrollVelocity(
  pointerY: number,
  top: number,
  bottom: number,
  edge: number = AUTO_SCROLL_EDGE_PX,
  maxVelocity: number = AUTO_SCROLL_MAX_VELOCITY,
): number {
  const band = Math.max(1, Math.min(edge, (bottom - top) / 2));
  const fromTop = pointerY - top;
  const fromBottom = bottom - pointerY;

  if (fromTop < band) {
    const depth = Math.max(0, 1 - fromTop / band);
    return -Math.min(maxVelocity, maxVelocity * depth);
  }
  if (fromBottom < band) {
    const depth = Math.max(0, 1 - fromBottom / band);
    return Math.min(maxVelocity, maxVelocity * depth);
  }
  return 0;
}
