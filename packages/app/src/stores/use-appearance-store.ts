import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

import {
  APPEARANCE_STORAGE_KEY,
  DEFAULT_APPEARANCE,
  applyAppearance,
  sanitizeAppearance,
  type AppearancePrefs,
} from "@/lib/appearance";

const PERSIST_TRAILING_MS = 150;

let pendingWrite: { name: string; value: string } | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * localStorage is synchronous and a slider drag emits dozens of sets; keep only
 * the newest row and write it once the pointer settles (AU7-11).
 */
function flushPendingWrite(): void {
  if (writeTimer !== null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  const write = pendingWrite;
  pendingWrite = null;
  if (write === null) return;
  try {
    localStorage.setItem(write.name, write.value);
  } catch {
    /* storage unavailable */
  }
}

const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      const raw = localStorage.getItem(name);
      if (raw === null) return null;
      JSON.parse(raw);
      return raw;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    pendingWrite = { name, value };
    if (writeTimer !== null) return;
    writeTimer = setTimeout(flushPendingWrite, PERSIST_TRAILING_MS);
  },
  removeItem: (name) => {
    pendingWrite = null;
    try {
      localStorage.removeItem(name);
    } catch {
      /* storage unavailable */
    }
  },
};

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flushPendingWrite);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPendingWrite();
  });
}

export interface AppearanceStoreState extends AppearancePrefs {
  update: (patch: Partial<AppearancePrefs>) => void;
  reset: () => void;
}

const selectPrefs = (state: AppearanceStoreState): AppearancePrefs => ({
  glass: state.glass,
  ambient: state.ambient,
  density: state.density,
  uiScale: state.uiScale,
  radius: state.radius,
  marketColors: state.marketColors,
});

export const useAppearanceStore = create<AppearanceStoreState>()(
  persist(
    (set) => ({
      ...DEFAULT_APPEARANCE,
      update: (patch) => {
        set((state) => sanitizeAppearance({ ...state, ...patch }));
      },
      reset: () => {
        set(DEFAULT_APPEARANCE);
      },
    }),
    {
      name: APPEARANCE_STORAGE_KEY,
      version: 2,
      storage: createJSONStorage(() => safeStorage),
      partialize: selectPrefs,
      migrate: (persisted) => sanitizeAppearance(persisted),
      merge: (persisted, current) => ({ ...current, ...sanitizeAppearance(persisted) }),
    },
  ),
);

/**
 * A settings write only needs one DOM application per frame; coalescing keeps a
 * slider drag from rewriting the root dataset and knobs on every input event.
 */
let applyHandle: number | null = null;
let pendingAppearance: AppearancePrefs | null = null;

function scheduleApply(prefs: AppearancePrefs): void {
  pendingAppearance = prefs;
  if (typeof requestAnimationFrame !== "function") {
    const next = pendingAppearance;
    pendingAppearance = null;
    applyAppearance(next);
    return;
  }
  if (applyHandle !== null) return;
  applyHandle = requestAnimationFrame(() => {
    applyHandle = null;
    const next = pendingAppearance;
    pendingAppearance = null;
    if (next !== null) applyAppearance(next);
  });
}

useAppearanceStore.subscribe((state) => {
  scheduleApply(state);
});
