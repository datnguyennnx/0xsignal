import { create } from "zustand";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

type Theme = "dark" | "light" | "system";

const getInitialTheme = (): Theme => {
  try {
    const stored = localStorage.getItem("vite-ui-theme");
    if (stored === "dark" || stored === "light" || stored === "system") return stored;
  } catch {
    // localStorage unavailable — use default
  }
  return "dark";
};

const getSystemTheme = (): "dark" | "light" => {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const applyThemeClass = (resolved: "dark" | "light") => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
};

function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light" || value === "system";
}

/**
 * Legacy versions persisted `activeAddress`/`viewedAddress`. They are deliberately
 * dropped here: a viewed wallet must never survive into the next session, because
 * the store has no way to prove it belongs to the connected account.
 */
export function migratePersistedAppState(value: unknown): { theme: Theme } {
  if (typeof value !== "object" || value === null) return { theme: "dark" };
  const theme = "theme" in value ? value.theme : undefined;
  return { theme: isTheme(theme) ? theme : "dark" };
}

/** Only the theme is durable; addresses belong to the session or the route. */
export function selectPersistedAppState(state: { theme: Theme }): { theme: Theme } {
  return { theme: state.theme };
}

/** Keep in sync with backend MARKET_SCHEMA_VERSION (cache.ts). Bump when payload shape changes. */
const FRONTEND_MARKET_SCHEMA_VERSION = 2;
const MARKET_SCHEMA_KEY = "0xsignal_market_schema_version";

export interface AppStoreState {
  theme: Theme;
  systemTheme: "dark" | "light";
  connectWalletOpen: Record<string, boolean>;
  dirtyFormPaths: Set<string>;

  setTheme: (theme: Theme) => void;
  setSystemTheme: (sys: "dark" | "light") => void;
  openConnectWallet: (key: string) => void;
  closeConnectWallet: (key: string) => void;
  isConnectWalletOpen: (key: string) => boolean;
  markDirty: (path: string) => void;
  markClean: (path: string) => void;
  hasUnsavedChanges: () => boolean;
  checkSchemaVersion: () => void;
}

export const useAppStore = create<AppStoreState>()(
  subscribeWithSelector(
    persist(
      (set, get) => {
        const initialSystemTheme = getSystemTheme();
        const initialTheme = getInitialTheme();
        const initialResolved = initialTheme === "system" ? initialSystemTheme : initialTheme;

        // Apply theme class immediately on creation
        applyThemeClass(initialResolved);

        return {
          theme: initialTheme,
          systemTheme: initialSystemTheme,
          connectWalletOpen: {},
          dirtyFormPaths: new Set<string>(),

          setTheme: (newTheme: Theme) => {
            localStorage.setItem("vite-ui-theme", newTheme);
            const systemTheme = get().systemTheme;
            const resolved = newTheme === "system" ? systemTheme : newTheme;
            applyThemeClass(resolved);
            set({ theme: newTheme });
          },

          setSystemTheme: (sys: "dark" | "light") => {
            const theme = get().theme;
            const resolved = theme === "system" ? sys : theme;
            applyThemeClass(resolved);
            set({ systemTheme: sys });
          },

          openConnectWallet: (key: string) => {
            set((state) => ({
              connectWalletOpen: { ...state.connectWalletOpen, [key]: true },
            }));
          },

          closeConnectWallet: (key: string) => {
            set((state) => ({
              connectWalletOpen: { ...state.connectWalletOpen, [key]: false },
            }));
          },

          isConnectWalletOpen: (key: string) => {
            return get().connectWalletOpen[key] ?? false;
          },

          markDirty: (path: string) => {
            set((state) => ({
              dirtyFormPaths: new Set([...state.dirtyFormPaths, path]),
            }));
          },

          markClean: (path: string) => {
            set((state) => {
              const next = new Set(state.dirtyFormPaths);
              next.delete(path);
              return { dirtyFormPaths: next };
            });
          },

          hasUnsavedChanges: () => {
            return get().dirtyFormPaths.size > 0;
          },

          checkSchemaVersion: () => {
            const stored = localStorage.getItem(MARKET_SCHEMA_KEY);
            if (stored !== String(FRONTEND_MARKET_SCHEMA_VERSION)) {
              queryClient.removeQueries({ queryKey: queryKeys.market.all });
              queryClient.removeQueries({ queryKey: ["market", "candles"] });
              void queryClient.invalidateQueries();
              localStorage.setItem(MARKET_SCHEMA_KEY, String(FRONTEND_MARKET_SCHEMA_VERSION));
            }
          },
        };
      },
      {
        name: "0xsignal-app-store",
        // v2 dropped the persisted address fields; the bump makes any stored v1 blob
        // pass through migrate, which discards the address instead of rehydrating it.
        version: 2,
        partialize: (state) => selectPersistedAppState(state),
        migrate: (persistedState) => migratePersistedAppState(persistedState),
        onRehydrateStorage: () => {
          return (state) => {
            if (!state) return;
            const resolved = state.theme === "system" ? state.systemTheme : state.theme;
            applyThemeClass(resolved);
          };
        },
      },
    ),
  ),
);

let appStoreInitialized = false;

export function initAppStore(): void {
  if (appStoreInitialized || typeof window === "undefined") return;
  appStoreInitialized = true;

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", (e) => {
    useAppStore.getState().setSystemTheme(e.matches ? "dark" : "light");
  });

  window.addEventListener("beforeunload", (e) => {
    if (useAppStore.getState().hasUnsavedChanges()) {
      e.preventDefault();
    }
  });
}
