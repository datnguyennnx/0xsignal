/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import {
  migratePersistedAppState,
  selectPersistedAppState,
  useAppStore,
} from "../stores/use-app-store";

const WHALE = "0x0000000000000000000000000000000000000002";

describe("persisted app store", () => {
  test("a legacy stored address is discarded, not resurrected", () => {
    const migrated = migratePersistedAppState({
      theme: "light",
      activeAddress: WHALE,
      viewedAddress: WHALE,
    });

    expect(migrated).toEqual({ theme: "light" });
    expect("activeAddress" in migrated).toBe(false);
  });

  test("the live store exposes no address fields", () => {
    const state: Record<string, unknown> = useAppStore.getState();
    expect(state["activeAddress"]).toBeUndefined();
    expect(state["setActiveAddress"]).toBeUndefined();
    expect(state["clearActiveAddress"]).toBeUndefined();
  });

  test("partialize keeps only the theme", () => {
    const persisted = selectPersistedAppState({ theme: "light" });
    expect(persisted).toEqual({ theme: "light" });
    expect(Object.keys(persisted)).toEqual(["theme"]);
  });
});
