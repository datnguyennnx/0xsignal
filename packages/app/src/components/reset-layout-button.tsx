import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLayoutStore } from "@/stores/use-layout-store";

export function ResetLayoutButton() {
  return (
    <Button
      variant="outline"
      size="icon"
      data-dense
      title="Reset Dashboard Layout"
      onClick={() => {
        useLayoutStore.getState().resetLayout();
        toast.success("Dashboard layout reset");
      }}
    >
      <RotateCcw className="size-icon" />
      <span className="sr-only">Reset Dashboard Layout</span>
    </Button>
  );
}
