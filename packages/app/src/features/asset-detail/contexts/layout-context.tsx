import { type ReactNode } from "react";
import { LayoutContext, defaultStore } from "./layout-store";

/**
 * Provides the layout store to child components via React Context.
 * This enables proper SSR compatibility, tree-shaking, and isolated testing.
 * Wrap at the level where dashboard layout state is needed (e.g., DashboardGrid).
 */
export function LayoutProvider({ children }: { children: ReactNode }) {
  // Use the default store instance. Future refactor: create a scoped store here.
  return <LayoutContext value={defaultStore}>{children}</LayoutContext>;
}
