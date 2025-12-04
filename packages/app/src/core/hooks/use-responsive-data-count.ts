import { useState, useEffect } from "react";

interface ResponsiveDataConfig {
  mobile: number; // < 640px
  tablet: number; // 640-1024px
  desktop: number; // 1024-1280px
  desktopWide?: number; // 1280-1536px (Optional, defaults to desktop)
  desktop2xl?: number; // 1536-1920px (Optional, defaults to desktopWide or desktop)
  desktop4k: number; // >= 1920px
}

/**
 * Hook to determine how many data items to display based on screen size.
 * Larger screens = more data density.
 */
export function useResponsiveDataCount(config: ResponsiveDataConfig): number {
  const getDataCount = () => {
    const width = window.innerWidth;
    if (width < 640) return config.mobile;
    if (width < 1024) return config.tablet;
    if (width < 1280) return config.desktop;
    if (width < 1536) return config.desktopWide ?? config.desktop;
    if (width < 1920) return config.desktop2xl ?? config.desktopWide ?? config.desktop;
    return config.desktop4k;
  };

  const [dataCount, setDataCount] = useState(getDataCount);

  useEffect(() => {
    const handleResize = () => setDataCount(getDataCount());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [config.mobile, config.tablet, config.desktop, config.desktop4k]);

  return dataCount;
}
