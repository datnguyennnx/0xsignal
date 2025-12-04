import { useState, useEffect } from "react";

const BREAKPOINTS = { SM: 640, MD: 1024, LG: 1280, XL: 1536, XXL: 1920 } as const;

interface ResponsiveDataConfig {
  mobile: number;
  tablet: number;
  desktop: number;
  desktopWide?: number;
  desktop2xl?: number;
  desktop4k: number;
}

export function useResponsiveDataCount(config: ResponsiveDataConfig): number {
  const getDataCount = () => {
    const width = window.innerWidth;
    if (width < BREAKPOINTS.SM) return config.mobile;
    if (width < BREAKPOINTS.MD) return config.tablet;
    if (width < BREAKPOINTS.LG) return config.desktop;
    if (width < BREAKPOINTS.XL) return config.desktopWide ?? config.desktop;
    if (width < BREAKPOINTS.XXL) return config.desktop2xl ?? config.desktopWide ?? config.desktop;
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
