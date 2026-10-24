import { remToPx } from "@/core/utils/rem";

type TriggerRect = {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
};

type Viewport = {
  readonly width: number;
  readonly height: number;
};

export function computeOverlayPosition(
  triggerRect: TriggerRect,
  viewport: Viewport,
): { left: number; top: number } {
  let left = remToPx(0.5);
  let top = triggerRect.bottom + remToPx(0.5);

  if (viewport.width >= 640) {
    left = Math.max(remToPx(0.5), triggerRect.left);
    if (left + remToPx(43.75) > viewport.width) {
      left = Math.max(remToPx(0.5), viewport.width - remToPx(44.375));
    }
  }

  const dropdownHeight = remToPx(32.5);
  if (top + dropdownHeight > viewport.height - remToPx(1.25)) {
    top = triggerRect.top - dropdownHeight - remToPx(0.5);
  }
  if (top < remToPx(1.25)) {
    top = remToPx(1.25);
  }

  return { left, top };
}
