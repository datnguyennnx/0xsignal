import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";

interface HoverStateContextValue {
  hoveredCandle: ChartDataPoint | null;
}

interface HoverActionsContextValue {
  setHoveredCandle: (candle: ChartDataPoint | null) => void;
}

const HoverStateContext = createContext<HoverStateContextValue | null>(null);
const HoverActionsContext = createContext<HoverActionsContextValue | null>(null);

export function HoverProvider({ children }: { children: ReactNode }) {
  const [hoveredCandle, setHoveredCandleState] = useState<ChartDataPoint | null>(null);

  const setHoveredCandle = useCallback((candle: ChartDataPoint | null) => {
    setHoveredCandleState(candle);
  }, []);

  const stateValue = useMemo(() => ({ hoveredCandle }), [hoveredCandle]);
  const actionValue = useMemo(() => ({ setHoveredCandle }), [setHoveredCandle]);

  return (
    <HoverStateContext.Provider value={stateValue}>
      <HoverActionsContext.Provider value={actionValue}>{children}</HoverActionsContext.Provider>
    </HoverStateContext.Provider>
  );
}

export function useHoverState(): HoverStateContextValue {
  const context = useContext(HoverStateContext);
  if (!context) throw new Error("useHoverState must be used within a HoverProvider");
  return context;
}

export function useHoverActions(): HoverActionsContextValue {
  const context = useContext(HoverActionsContext);
  if (!context) throw new Error("useHoverActions must be used within a HoverProvider");
  return context;
}
