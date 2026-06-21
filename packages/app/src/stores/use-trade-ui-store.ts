import { create } from "zustand";
import { persist } from "zustand/middleware";

const DEFAULT_N_SIG_FIGS = 5;

export interface TradeUIStoreState {
  nSigFigs: number | null;
  setNSigFigs: (n: number | null) => void;
}

export const useTradeUIStore = create<TradeUIStoreState>()(
  persist(
    (set) => ({
      nSigFigs: DEFAULT_N_SIG_FIGS,

      setNSigFigs: (n: number | null) => {
        if (n === null) {
          set({ nSigFigs: null });
          return;
        }
        const clamped = Math.max(2, Math.min(5, Math.round(n)));
        set({ nSigFigs: clamped });
      },
    }),
    {
      name: "trade-ui-prefs",
      partialize: (state) => ({ nSigFigs: state.nSigFigs }),
    },
  ),
);
