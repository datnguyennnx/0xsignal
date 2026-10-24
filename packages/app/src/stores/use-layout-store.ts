import { create } from "zustand";
import { persist, createJSONStorage, type PersistStorage } from "zustand/middleware";
import {
  INITIAL_LAYOUT,
  LAYOUT_STORAGE_KEY,
  initialLayoutForViewport,
} from "@/features/asset-detail/utils/constants";
import { resolveCollisions, clampToMin } from "@/features/asset-detail/utils/collision";
import type { LayoutItem } from "@/features/asset-detail/utils/types";

type PersistedLayout = { items: LayoutItem[] };

/** SSR has no viewport; the desktop preset is the safe first paint. */
function viewportLayout(): LayoutItem[] {
  if (typeof window === "undefined") return structuredClone(INITIAL_LAYOUT);
  return initialLayoutForViewport(window.innerWidth, window.innerHeight);
}

interface PersistedLayoutState {
  state: PersistedLayout;
  version?: number;
}

function isLayoutItem(value: unknown): value is LayoutItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "i" in value &&
    typeof value.i === "string" &&
    "x" in value &&
    typeof value.x === "number" &&
    "y" in value &&
    typeof value.y === "number" &&
    "w" in value &&
    typeof value.w === "number" &&
    "h" in value &&
    typeof value.h === "number"
  );
}

function isLayoutItems(value: unknown): value is LayoutItem[] {
  return Array.isArray(value) && value.every((item) => isLayoutItem(item));
}

function isPersistedLayout(value: unknown): value is PersistedLayout {
  return (
    typeof value === "object" && value !== null && "items" in value && isLayoutItems(value.items)
  );
}

function isPersistedLayoutState(value: unknown): value is PersistedLayoutState {
  return (
    typeof value === "object" &&
    value !== null &&
    "state" in value &&
    isPersistedLayout(value.state)
  );
}

const jsonStorage = createJSONStorage<PersistedLayout>(() => localStorage);

// Older releases stored a bare array under the layout key; present it as a v0
// state so the persist `migrate` hook upgrades it lazily at rehydrate time.
const layoutStorage: PersistStorage<PersistedLayout> | undefined = jsonStorage
  ? {
      ...jsonStorage,
      getItem: (name) => {
        const value: unknown = jsonStorage.getItem(name);
        if (Array.isArray(value)) {
          return isLayoutItems(value) ? { state: { items: value }, version: 0 } : null;
        }
        return isPersistedLayoutState(value) ? value : null;
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
      items: viewportLayout(),

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
        const clamped = items.map((item) => clampToMin(item));
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
        set({ items: viewportLayout() });
      },
    }),
    {
      name: LAYOUT_STORAGE_KEY,
      version: 6,
      storage: layoutStorage,
      partialize: (state) => ({ items: state.items }),
      migrate: (persisted, version) => {
        // v1 stored the stacked layout (positions as a full-width second row); its
        // geometry cannot be mapped onto the viewport-locked columns, so reset it.
        // v2 predates the compact preset, v3 the 6/3/3 split, v4 the 12-column
        // grid and v5 the 24-column grid — all in the wrong column space, so re-seed.
        if (version < 6) return { items: viewportLayout() };
        if (isPersistedLayout(persisted)) return { items: persisted.items };
        return { items: viewportLayout() };
      },
    },
  ),
);
