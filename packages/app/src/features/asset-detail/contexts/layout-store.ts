import { useSyncExternalStore, createContext, useContext } from "react";
import { INITIAL_LAYOUT, LAYOUT_STORAGE_KEY } from "../utils/constants";
import { resolveCollisions, clampToMin } from "../utils/collision";
import type { LayoutItem } from "../utils/types";

// Structured Clone helper with JSON fallback
const cloneDeep = <T>(value: T): T => {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
};

type Listener = () => void;

export interface LayoutStore {
  subscribe: (cb: Listener) => () => void;
  getSnapshot: () => LayoutItem[];
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

function createLayoutStore(): LayoutStore {
  let layout: LayoutItem[] = loadFromStorage();
  const listeners = new Set<Listener>();

  function loadFromStorage(): LayoutItem[] {
    try {
      const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // corrupted storage — fall through to default
    }
    return cloneDeep(INITIAL_LAYOUT);
  }

  function persist() {
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // Storage full or unavailable — silently degrade
    }
  }

  function notify() {
    listeners.forEach((fn) => fn());
  }

  return {
    subscribe(callback: Listener) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },

    getSnapshot: () => layout,

    updateLayoutItem(id: string, patch: Partial<LayoutItem>): void {
      layout = layout.map((item) => (item.i === id ? { ...item, ...patch } : item));
      persist();
      notify();
    },

    /**
     * Replace the entire layout after resolving collisions.
     * This is the ONLY function that should be called after a resize gesture.
     */
    commitLayout(
      items: LayoutItem[],
      activeItemId?: string,
      interactionType?: "drag" | "resize",
      originalItem?: LayoutItem,
    ): void {
      const clamped = items.map(clampToMin);
      const resolved = resolveCollisions(clamped, activeItemId, interactionType, originalItem);
      layout = resolved;
      persist();
      notify();
    },

    /**
     * Replace the entire layout directly (without collision resolution).
     */
    replaceLayout(items: LayoutItem[]): void {
      layout = [...items];
      persist();
      notify();
    },

    /**
     * Reset the layout to the initial default and clear localStorage.
     */
    resetLayout(): void {
      try {
        localStorage.removeItem(LAYOUT_STORAGE_KEY);
      } catch {
        // ignore
      }
      layout = cloneDeep(INITIAL_LAYOUT);
      notify();
    },
  };
}

const defaultStore = createLayoutStore();

const LayoutContext = createContext<LayoutStore | null>(null);

// Internal hook to access the store from context (with fallback)
function useLayoutStore(): LayoutStore {
  const store = useContext(LayoutContext);
  if (!store) {
    // Fallback: if no provider, use the default store (backward compatibility).
    // This allows `useLayout()` to work without explicit LayoutProvider.
    return defaultStore;
  }
  return store;
}

/** Returns all layout items. Re-renders on any layout change. */
export function useLayout(): LayoutItem[] {
  const store = useLayoutStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

// Public Actions (module-level, backward-compatible singleton)

export const commitLayout: LayoutStore["commitLayout"] = (
  items,
  activeItemId,
  interactionType,
  originalItem,
) => {
  defaultStore.commitLayout(items, activeItemId, interactionType, originalItem);
};

/** Reset layout to default and clear localStorage. */
export const resetLayout: LayoutStore["resetLayout"] = () => {
  defaultStore.resetLayout();
};

export { LayoutContext, defaultStore };
