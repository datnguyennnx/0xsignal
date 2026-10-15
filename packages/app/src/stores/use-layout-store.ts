import { create } from "zustand";
import { persist, createJSONStorage, type PersistStorage } from "zustand/middleware";
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

type PersistedLayout = { items: LayoutItem[] };

const jsonStorage = createJSONStorage<PersistedLayout>(() => localStorage);

// Older releases stored a bare array under the layout key; present it as a v0
// state so the persist `migrate` hook upgrades it lazily at rehydrate time.
const layoutStorage: PersistStorage<PersistedLayout> | undefined = jsonStorage
  ? {
      ...jsonStorage,
      getItem: (name) => {
        const value: unknown = jsonStorage.getItem(name);
        return Array.isArray(value)
          ? { state: value as unknown as PersistedLayout, version: 0 }
          : (value as ReturnType<typeof jsonStorage.getItem>);
      },
    }
  : undefined;

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
      version: 1,
      storage: layoutStorage,
      partialize: (state) => ({ items: state.items }),
      migrate: (persisted, _version) => {
        if (Array.isArray(persisted)) return { items: persisted as LayoutItem[] };
        const items = (persisted as PersistedLayout | undefined)?.items;
        return Array.isArray(items) ? { items } : { items: cloneDeep(INITIAL_LAYOUT) };
      },
    },
  ),
);
