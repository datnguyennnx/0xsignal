import type { ReactNode } from "react";
import { useNavigation } from "react-router";

/** The router already owns navigation state; the bar is a view of it, not a store. */
export function NavigationProgress(): ReactNode {
  const { state } = useNavigation();
  if (state !== "loading") return null;

  return (
    <div
      aria-hidden="true"
      data-navigation-progress
      data-state="visible"
      className="pointer-events-none fixed inset-x-0 top-0 z-(--z-bar) h-0.5 bg-info"
    />
  );
}
