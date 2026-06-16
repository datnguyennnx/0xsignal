import { useSyncExternalStore, useRef, createContext, useContext } from "react";
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

// Store Factory
type Listener = () => void;

export interface LayoutStore {
  subscribe: (cb: Listener) => () => void;
  getSnapshot: () => LayoutItem[];
  updateLayoutItem: (id: string, patch: Partial<LayoutItem>) => void;
  commitLayout: (
    items: LayoutItem[],
    activeItemId?: string,
    interactionType?: "drag" | "resize",
    originalItem?: LayoutItem
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
      originalItem?: LayoutItem
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

// Default Store Instance
const defaultStore = createLayoutStore();

// React Context
const LayoutContext = createContext<LayoutStore | null>(null);

// Internal hook to access the store from context (with fallback)
function useLayoutStore(): LayoutStore {
  const store = useContext(LayoutContext);
  if (!store) {
    // Fallback: if no provider, use the default store (backward compatibility).
    // This allows `useLayout()` / `useLayoutItem()` to work without explicit LayoutProvider.
    return defaultStore;
  }
  return store;
}

// Public Hooks

/** Returns all layout items. Re-renders the subscribing component on any layout change. */
export function useLayout(): LayoutItem[] {
  const store = useLayoutStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

/** Returns a single layout item by id, or undefined if not found. Only re-renders when that specific item changes. */
export function useLayoutItem(id: string): LayoutItem | undefined {
  const store = useLayoutStore();
  const prevRef = useRef<LayoutItem | undefined>(undefined);
  return useSyncExternalStore(store.subscribe, () => {
    const item = store.getSnapshot().find((i) => i.i === id);
    const prev = prevRef.current;
    if (
      prev &&
      item &&
      prev.i === item.i &&
      prev.x === item.x &&
      prev.y === item.y &&
      prev.w === item.w &&
      prev.h === item.h &&
      prev.minW === item.minW &&
      prev.minH === item.minH
    ) {
      return prev;
    }
    prevRef.current = item;
    return item;
  });
}

// Public Actions (module-level, backward-compatible singleton)

/**
 * Update a single layout item's properties directly.
 * Triggers re-render and persists to localStorage.
 * Use for programmatic changes (e.g., reset, theme toggles).
 * For drag/resize operations, use commitLayout instead.
 */
export const updateLayoutItem: LayoutStore["updateLayoutItem"] = (id, patch) => {
  defaultStore.updateLayoutItem(id, patch);
};

/**
 * Replace the entire layout after resolving collisions.
 * This is the ONLY function that should be called after a resize gesture.
 */
export const commitLayout: LayoutStore["commitLayout"] = (
  items,
  activeItemId,
  interactionType,
  originalItem
) => {
  defaultStore.commitLayout(items, activeItemId, interactionType, originalItem);
};

/**
 * Replace the entire layout directly (without collision resolution).
 * Use for batch programmatic updates where you've already resolved collisions.
 */
export const replaceLayout: LayoutStore["replaceLayout"] = (items) => {
  defaultStore.replaceLayout(items);
};

/**
 * Reset the layout to the initial default and clear localStorage.
 */
export const resetLayout: LayoutStore["resetLayout"] = () => {
  defaultStore.resetLayout();
};

// Exports for internal use by LayoutProvider
export { LayoutContext, defaultStore };
