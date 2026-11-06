import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_SIG_FIGS, MAX_SIG_FIGS, MIN_SIG_FIGS } from "@/core/utils/formatters";

export interface TradeUIStoreState {
  nSigFigs: number | null;
  setNSigFigs: (n: number | null) => void;
}

export const useTradeUIStore = create<TradeUIStoreState>()(
  persist(
    (set) => ({
      nSigFigs: DEFAULT_SIG_FIGS,

      setNSigFigs: (n: number | null) => {
        if (n === null) {
          set({ nSigFigs: null });
          return;
        }
        const clamped = Math.max(MIN_SIG_FIGS, Math.min(MAX_SIG_FIGS, Math.round(n)));
        set({ nSigFigs: clamped });
      },
    }),
    {
      name: "trade-ui-prefs",
      partialize: (state) => ({ nSigFigs: state.nSigFigs }),
    },
  ),
);
