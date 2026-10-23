import { useEffect } from "react";
import { useAppStore } from "@/stores/use-app-store";

/** Mirrors a settings form's dirty state into the app store's unsaved-changes guard. */
export function useFormDirtyTracker(formPath: string, hasChanges: boolean): void {
  useEffect(() => {
    const store = useAppStore.getState();
    if (hasChanges) {
      store.markDirty(formPath);
    } else {
      store.markClean(formPath);
    }
    return () => {
      useAppStore.getState().markClean(formPath);
    };
  }, [formPath, hasChanges]);
}
