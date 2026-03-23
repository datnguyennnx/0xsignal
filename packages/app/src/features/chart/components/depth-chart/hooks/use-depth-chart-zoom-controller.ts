import { useCallback, useEffect, useRef, useState } from "react";
import { clampHalfSpan } from "../lib/depth-visible-range";

const INTERACTION_IDLE_MS = 180;
const MIN_ZOOM_STEP = 0.92;
const MAX_ZOOM_STEP = 1.08;
const ZOOM_EPSILON = 0.00000001;

interface UseDepthChartZoomControllerOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  freezeVisibleRange: boolean;
  symbol: string;
  minHalfSpan: number | null;
  maxHalfSpan: number | null;
  defaultHalfSpan: number | null;
  committedHalfSpan: number | null;
  onInteractionChange?: (interacting: boolean) => void;
}

interface UseDepthChartZoomControllerResult {
  desiredHalfSpan: number | null;
  isInteracting: boolean;
  commitHalfSpan: (nextHalfSpan: number | null) => void;
  seedHalfSpan: (nextHalfSpan: number | null) => void;
}

const distanceBetweenTouches = (touchA: Touch, touchB: Touch): number => {
  const dx = touchA.clientX - touchB.clientX;
  const dy = touchA.clientY - touchB.clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

export function useDepthChartZoomController({
  containerRef,
  freezeVisibleRange,
  symbol,
  minHalfSpan,
  maxHalfSpan,
  defaultHalfSpan,
  committedHalfSpan,
  onInteractionChange,
}: UseDepthChartZoomControllerOptions): UseDepthChartZoomControllerResult {
  const [desiredHalfSpan, setDesiredHalfSpan] = useState<number | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const desiredHalfSpanRef = useRef<number | null>(null);
  const interactionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pinchDistanceRef = useRef<number | null>(null);

  const minHalfSpanRef = useRef(minHalfSpan);
  const maxHalfSpanRef = useRef(maxHalfSpan);
  const defaultHalfSpanRef = useRef(defaultHalfSpan);
  const committedHalfSpanRef = useRef(committedHalfSpan);
  const freezeVisibleRangeRef = useRef(freezeVisibleRange);

  useEffect(() => {
    minHalfSpanRef.current = minHalfSpan;
    maxHalfSpanRef.current = maxHalfSpan;
    defaultHalfSpanRef.current = defaultHalfSpan;
    committedHalfSpanRef.current = committedHalfSpan;
    freezeVisibleRangeRef.current = freezeVisibleRange;
  }, [committedHalfSpan, defaultHalfSpan, freezeVisibleRange, maxHalfSpan, minHalfSpan]);

  useEffect(() => {
    desiredHalfSpanRef.current = desiredHalfSpan;
  }, [desiredHalfSpan]);

  useEffect(() => {
    setDesiredHalfSpan(null);
    setIsInteracting(false);
  }, [symbol]);

  const markInteraction = useCallback(() => {
    setIsInteracting(true);
    onInteractionChange?.(true);

    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
      onInteractionChange?.(false);
    }, INTERACTION_IDLE_MS);
  }, [onInteractionChange]);

  const requestZoomByFactor = useCallback(
    (zoomFactor: number) => {
      if (freezeVisibleRangeRef.current) {
        return;
      }

      markInteraction();
      const minSpan = minHalfSpanRef.current;
      const maxSpan = maxHalfSpanRef.current;
      const baseHalfSpan =
        desiredHalfSpanRef.current ?? committedHalfSpanRef.current ?? defaultHalfSpanRef.current;

      if (baseHalfSpan === null || minSpan === null || maxSpan === null) {
        return;
      }

      const normalizedFactor = Number.isFinite(zoomFactor)
        ? Math.min(Math.max(zoomFactor, 0.65), 1.35)
        : 1;
      const nextHalfSpan = clampHalfSpan(baseHalfSpan * normalizedFactor, minSpan, maxSpan);
      if (nextHalfSpan === null || Math.abs(nextHalfSpan - baseHalfSpan) <= ZOOM_EPSILON) {
        return;
      }

      setDesiredHalfSpan(nextHalfSpan);
    },
    [markInteraction]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleWheelZoom = (event: WheelEvent) => {
      event.preventDefault();
      const normalizedDelta = Math.max(Math.min(event.deltaY, 120), -120);
      const rawFactor = 1 + normalizedDelta * 0.0012;
      const zoomFactor = Math.min(Math.max(rawFactor, MIN_ZOOM_STEP), MAX_ZOOM_STEP);
      requestZoomByFactor(zoomFactor);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length >= 2) {
        pinchDistanceRef.current = distanceBetweenTouches(event.touches[0], event.touches[1]);
      } else {
        pinchDistanceRef.current = null;
        markInteraction();
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        markInteraction();
        return;
      }

      event.preventDefault();
      const previousDistance = pinchDistanceRef.current;
      const nextDistance = distanceBetweenTouches(event.touches[0], event.touches[1]);
      pinchDistanceRef.current = nextDistance;

      if (
        previousDistance === null ||
        !Number.isFinite(previousDistance) ||
        !Number.isFinite(nextDistance)
      ) {
        return;
      }

      const delta = nextDistance - previousDistance;
      if (Math.abs(delta) < 2) {
        return;
      }

      const ratio = previousDistance / nextDistance;
      const zoomFactor = Math.min(Math.max(ratio, 0.9), 1.1);
      requestZoomByFactor(zoomFactor);
    };

    const handleTouchEnd = () => {
      pinchDistanceRef.current = null;
    };

    container.addEventListener("wheel", handleWheelZoom, { passive: false });
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
      container.removeEventListener("wheel", handleWheelZoom);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [containerRef, markInteraction, requestZoomByFactor]);

  const commitHalfSpan = useCallback((nextHalfSpan: number | null) => {
    if (nextHalfSpan === null) {
      return;
    }
    setDesiredHalfSpan((current) => {
      if (current === null) {
        return current;
      }
      return Math.abs(current - nextHalfSpan) <= ZOOM_EPSILON ? null : current;
    });
  }, []);

  const seedHalfSpan = useCallback((nextHalfSpan: number | null) => {
    if (nextHalfSpan === null) {
      return;
    }
    setDesiredHalfSpan((current) => current ?? nextHalfSpan);
  }, []);

  return {
    desiredHalfSpan,
    isInteracting,
    commitHalfSpan,
    seedHalfSpan,
  };
}
