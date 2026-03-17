/** @fileoverview Fullscreen hook - manages fullscreen state */
import { useState, useCallback, useEffect, useRef } from "react";

interface UseFullscreenResult {
  isFullscreen: boolean;
  toggleFullscreen: () => void;
  fullscreenContainerRef: React.RefObject<HTMLDivElement | null>;
}

export const useFullscreen = (): UseFullscreenResult => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const isFullscreenRef = useRef(false);

  useEffect(() => {
    isFullscreenRef.current = isFullscreen;
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isFullscreen]);

  return {
    isFullscreen,
    toggleFullscreen,
    fullscreenContainerRef,
  };
};
