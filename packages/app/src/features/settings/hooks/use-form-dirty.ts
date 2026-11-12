import { useEffect } from "react";
import { useAppStore } from "@/stores/use-app-store";

/**
 * Publishes a form's dirty flag to the global guard once per transition, not per
 * keystroke: `hasChanges` is derived by the caller from its own form state.
 */
export function useFormDirtyTracker(formPath: string, hasChanges: boolean): void {
  const markDirty = useAppStore((state) => state.markDirty);
  const markClean = useAppStore((state) => state.markClean);

  useEffect(() => {
    if (hasChanges) {
      markDirty(formPath);
    } else {
      markClean(formPath);
    }

    return () => {
      markClean(formPath);
    };
  }, [formPath, hasChanges, markDirty, markClean]);
}
