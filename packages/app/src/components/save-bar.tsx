import { Button } from "@/components/ui/button";
import { Surface } from "@/components/surface/surface";

interface SaveBarProps {
  open: boolean;
  onSave: () => void;
  onReset: () => void;
  isSaving?: boolean;
  message?: string;
}

export function SaveBar({ open, onSave, onReset, isSaving, message }: SaveBarProps) {
  return (
    <div
      data-open={open}
      className="fixed inset-x-0 bottom-0 z-[100] grid translate-y-full transition-transform duration-200 ease-premium data-[open=true]:translate-y-0"
    >
      <div className="mx-auto w-full max-w-2xl px-[clamp(1rem,1.5vw,1.5rem)] pb-[clamp(1rem,1.5vw,1.5rem)]">
        <Surface
          tier="floating"
          radius="control"
          className="flex items-center justify-between gap-4 px-[clamp(1rem,1.5vw,1.5rem)] py-[clamp(0.75rem,1vw,1rem)]"
        >
          <p className="text-sm text-muted-foreground">{message ?? "You have unsaved changes"}</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onReset} disabled={isSaving}>
              Reset
            </Button>
            <Button size="sm" onClick={onSave} disabled={isSaving}>
              {isSaving === true ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </Surface>
      </div>
    </div>
  );
}
