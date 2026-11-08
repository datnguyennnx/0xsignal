import { Button } from "@/components/ui/button";
import { Surface } from "@/components/surface/surface";

interface SaveBarProps {
  open: boolean;
  onSave: () => void;
  onReset: () => void;
  isSaving?: boolean;
}

export function SaveBar({ open, onSave, onReset, isSaving }: SaveBarProps) {
  return (
    <div
      data-open={open}
      inert={!open}
      aria-hidden={!open}
      className="fixed inset-x-0 bottom-0 z-(--z-bar) grid translate-y-full transition-transform duration-(--dur-enter) ease-standard data-[open=true]:translate-y-0"
    >
      <div className="mx-auto w-full max-w-xl px-4 pb-4">
        <Surface
          tier="floating"
          radius="control"
          className="flex items-center justify-between gap-stack px-4 py-3"
        >
          <output aria-live="polite" className="type-body text-muted-foreground">
            You have unsaved changes
          </output>
          <div className="flex items-center gap-inline">
            <Button variant="ghost" onClick={onReset} disabled={isSaving}>
              Reset
            </Button>
            <Button onClick={onSave} disabled={isSaving}>
              {isSaving === true ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </Surface>
      </div>
    </div>
  );
}
