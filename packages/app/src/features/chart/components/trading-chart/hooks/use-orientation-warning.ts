import { useState, useEffect } from "react";
import { MOBILE_BREAKPOINT } from "../constants";

export const useOrientationWarning = (isFullscreen: boolean) => {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (!isFullscreen) {
      setShowWarning(false);
      return;
    }

    const checkOrientation = () => {
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
      const isPortrait = window.innerHeight > window.innerWidth;
      setShowWarning(isMobile && isPortrait);
    };

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, [isFullscreen]);

  return showWarning;
};
