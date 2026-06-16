import { useState, useEffect } from "react";

export function useOrderbookResize(): boolean {
  const [transitionsEnabled, setTransitionsEnabled] = useState(true);

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      setTransitionsEnabled(false);
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => setTransitionsEnabled(true));
      });
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return transitionsEnabled;
}
