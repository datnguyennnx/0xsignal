import { ModeToggle } from "@/components/mode-toggle";
import { useDocumentTitle } from "@/hooks/use-document-title";

export function SettingsPage() {
  useDocumentTitle({ title: "Settings" });

  return (
    <div className="flex flex-col min-h-0 overflow-y-auto">
      <div className="flex-1 px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Customize your experience</p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-border/40">
            <div>
              <p className="font-medium">Appearance</p>
              <p className="text-sm text-muted-foreground">Choose your preferred theme</p>
            </div>
            <div className="min-h-[44px]">
              <ModeToggle />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
