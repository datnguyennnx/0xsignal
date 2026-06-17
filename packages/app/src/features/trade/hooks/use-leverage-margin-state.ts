import { useState } from "react";

interface UseLeverageMarginStateOptions {
  currentLeverageFromChain: number;
  currentMarginTypeFromChain: "cross" | "isolated";
}

interface UseLeverageMarginStateReturn {
  adjustLeverageOpen: boolean;
  setAdjustLeverageOpen: (open: boolean) => void;
  marginModeOpen: boolean;
  setMarginModeOpen: (open: boolean) => void;
  overrideLeverage: number | null;
  setOverrideLeverage: (value: number | null) => void;
  overrideMarginMode: "cross" | "isolated" | null;
  setOverrideMarginMode: (value: "cross" | "isolated" | null) => void;
  effectiveLeverage: number;
  effectiveMarginMode: "cross" | "isolated";
}

/**
 * Manages leverage/margin override state and modal open/close state.
 *
 * - `overrideLeverage`/`overrideMarginMode` store user overrides (null = use chain value)
 * - `effectiveLeverage`/`effectiveMarginMode` are the resolved values (override ?? chain)
 * - Modal open states control visibility of AdjustLeverageModal and MarginModeModal
 */
export function useLeverageMarginState({
  currentLeverageFromChain,
  currentMarginTypeFromChain,
}: UseLeverageMarginStateOptions): UseLeverageMarginStateReturn {
  const [adjustLeverageOpen, setAdjustLeverageOpen] = useState(false);
  const [marginModeOpen, setMarginModeOpen] = useState(false);
  const [overrideLeverage, setOverrideLeverage] = useState<number | null>(null);
  const [overrideMarginMode, setOverrideMarginMode] = useState<"cross" | "isolated" | null>(null);

  const effectiveLeverage = overrideLeverage ?? currentLeverageFromChain;
  const effectiveMarginMode = overrideMarginMode ?? currentMarginTypeFromChain;

  return {
    adjustLeverageOpen,
    setAdjustLeverageOpen,
    marginModeOpen,
    setMarginModeOpen,
    overrideLeverage,
    setOverrideLeverage,
    overrideMarginMode,
    setOverrideMarginMode,
    effectiveLeverage,
    effectiveMarginMode,
  };
}
