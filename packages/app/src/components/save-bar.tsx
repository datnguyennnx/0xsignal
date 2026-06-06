import { Button } from "@/components/ui/button";

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
      className="fixed inset-x-0 bottom-0 z-50 grid transition-all duration-200 ease-premium data-[open=false]:translate-y-full data-[open=true]:translate-y-0"
    >
      <div className="mx-auto w-full max-w-2xl px-[clamp(1rem,1.5vw,1.5rem)] pb-[clamp(1rem,1.5vw,1.5rem)]">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border/20 bg-background/95 px-[clamp(1rem,1.5vw,1.5rem)] py-[clamp(0.75rem,1vw,1rem)] shadow-lg backdrop-blur-sm">
          <p className="text-sm text-muted-foreground">{message ?? "You have unsaved changes"}</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onReset} disabled={isSaving}>
              Reset
            </Button>
            <Button size="sm" onClick={onSave} disabled={isSaving}>
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
