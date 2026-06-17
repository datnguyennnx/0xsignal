import { useState } from "react";
import {
  useTakeProfitStopLoss,
  type UseTakeProfitStopLossOptions,
  type UseTakeProfitStopLossReturn,
} from "./use-take-profit-stop-loss";

export interface UseTpSlOrchestrationReturn extends UseTakeProfitStopLossReturn {
  reduceOnly: boolean;
  setReduceOnly: (enabled: boolean) => void;
  showTpSl: boolean;
}

/**
 * Orchestrates TP/SL and reduce-only checkbox interplay.
 *
 * - When reduceOnly is enabled, TP/SL is automatically disabled.
 * - When TP/SL is enabled, reduceOnly is automatically disabled.
 * - showTpSl is derived from tpSlEnabled && !reduceOnly.
 */
export function useTpSlOrchestration(
  options: UseTakeProfitStopLossOptions,
): UseTpSlOrchestrationReturn {
  const tpSl = useTakeProfitStopLoss(options);
  const [reduceOnly, setReduceOnlyState] = useState(false);

  const setReduceOnly = (enabled: boolean) => {
    setReduceOnlyState(enabled);
    if (enabled) tpSl.setTpSlEnabled(false);
  };

  const setTpSlEnabled = (enabled: boolean) => {
    tpSl.setTpSlEnabled(enabled);
    if (enabled) setReduceOnlyState(false);
  };

  const showTpSl = tpSl.tpSlEnabled && !reduceOnly;

  return {
    ...tpSl,
    setTpSlEnabled,
    reduceOnly,
    setReduceOnly,
    showTpSl,
  };
}
