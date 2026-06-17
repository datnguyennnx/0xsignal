import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { INITIAL_LAYOUT, LAYOUT_STORAGE_KEY } from "@/features/asset-detail/utils/constants";
import { resolveCollisions, clampToMin } from "@/features/asset-detail/utils/collision";
import type { LayoutItem } from "@/features/asset-detail/utils/types";

// Structured Clone helper with JSON fallback (same as original layout-store.ts)
const cloneDeep = <T>(value: T): T => {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
};

// Wrap plain-array format into Zustand persist format.
// Runs before store creation so the store rehydrates from the migrated data.
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        localStorage.setItem(
          LAYOUT_STORAGE_KEY,
          JSON.stringify({ state: { items: parsed }, version: 0 }),
        );
      }
    }
  } catch {
    /* ignore corrupt data */
  }
}

export interface LayoutStoreState {
  items: LayoutItem[];

  updateLayoutItem: (id: string, patch: Partial<LayoutItem>) => void;
  commitLayout: (
    items: LayoutItem[],
    activeItemId?: string,
    interactionType?: "drag" | "resize",
    originalItem?: LayoutItem,
  ) => void;
  replaceLayout: (items: LayoutItem[]) => void;
  resetLayout: () => void;
}

export const useLayoutStore = create<LayoutStoreState>()(
  persist(
    (set) => ({
      items: cloneDeep(INITIAL_LAYOUT),

      updateLayoutItem: (id: string, patch: Partial<LayoutItem>) => {
        set((state) => ({
          items: state.items.map((item) => (item.i === id ? { ...item, ...patch } : item)),
        }));
      },

      commitLayout: (
        items: LayoutItem[],
        activeItemId?: string,
        interactionType?: "drag" | "resize",
        originalItem?: LayoutItem,
      ) => {
        const clamped = items.map(clampToMin);
        const resolved = resolveCollisions(clamped, activeItemId, interactionType, originalItem);
        set({ items: resolved });
      },

      replaceLayout: (items: LayoutItem[]) => {
        set({ items: [...items] });
      },

      resetLayout: () => {
        try {
          localStorage.removeItem(LAYOUT_STORAGE_KEY);
        } catch {
          // ignore
        }
        set({ items: cloneDeep(INITIAL_LAYOUT) });
      },
    }),
    {
      name: LAYOUT_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    },
  ),
);
