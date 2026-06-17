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

/** Keep in sync with backend MARKET_SCHEMA_VERSION (cache.ts). Bump when payload shape changes. */
const FRONTEND_MARKET_SCHEMA_VERSION = 2;
const MARKET_SCHEMA_KEY = "0xsignal_market_schema_version";

export interface AppStoreState {
  theme: Theme;
  resolvedTheme: "dark" | "light";
  systemTheme: "dark" | "light";
  connectWalletOpen: Record<string, boolean>;
  dirtyFormPaths: Set<string>;
  marketSchemaVersion: number;

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
          resolvedTheme: initialResolved,
          systemTheme: initialSystemTheme,
          connectWalletOpen: {},
          dirtyFormPaths: new Set<string>(),
          marketSchemaVersion: FRONTEND_MARKET_SCHEMA_VERSION,

          setTheme: (newTheme: Theme) => {
            localStorage.setItem("vite-ui-theme", newTheme);
            const systemTheme = get().systemTheme;
            const resolved = newTheme === "system" ? systemTheme : newTheme;
            applyThemeClass(resolved);
            set({ theme: newTheme, resolvedTheme: resolved });
          },

          setSystemTheme: (sys: "dark" | "light") => {
            const theme = get().theme;
            const resolved = theme === "system" ? sys : (theme as "dark" | "light");
            applyThemeClass(resolved);
            set({ systemTheme: sys, resolvedTheme: resolved });
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
            set((state) => {
              const next = new Set(state.dirtyFormPaths);
              next.add(path);
              return { dirtyFormPaths: next };
            });
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
              queryClient.invalidateQueries();
              localStorage.setItem(MARKET_SCHEMA_KEY, String(FRONTEND_MARKET_SCHEMA_VERSION));
            }
          },
        };
      },
      {
        name: "vite-ui-theme",
        partialize: (state) => ({ theme: state.theme }),
        onRehydrateStorage: () => {
          return (state) => {
            if (!state) return;
            const resolved =
              state.theme === "system" ? state.systemTheme : (state.theme as "dark" | "light");
            state.resolvedTheme = resolved;
            applyThemeClass(resolved);
          };
        },
      },
    ),
  ),
);

// Module-level matchMedia listener for system theme changes
if (typeof window !== "undefined") {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => {
    useAppStore.getState().setSystemTheme(e.matches ? "dark" : "light");
  };
  mediaQuery.addEventListener("change", handler);
}

// Module-level beforeunload listener for dirty form detection
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => {
    if (useAppStore.getState().hasUnsavedChanges()) {
      e.preventDefault();
    }
  });
}
