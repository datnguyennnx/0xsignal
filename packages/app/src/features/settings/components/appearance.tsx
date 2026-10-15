import { Palette, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/use-app-store";
import { cn } from "cn";
import { useLayoutStore } from "@/stores/use-layout-store";

interface ThemeCardProps {
  value: "light" | "dark" | "system";
  label: string;
  theme: string;
  handleThemeChange: (newTheme: "light" | "dark" | "system") => void;
  children: React.ReactNode;
}

const ThemeCard = ({ value, label, theme, handleThemeChange, children }: ThemeCardProps) => (
  <button
    onClick={() => handleThemeChange(value)}
    className="flex flex-col items-center gap-3 flex-1 group cursor-pointer w-full text-center"
  >
    <div
      className={cn(
        "relative w-full aspect-[16/10] rounded-xl overflow-hidden border transition-[transform,box-shadow,border-color] duration-200 shadow-sm hover:scale-[1.02] hover:shadow-md",
        theme === value
          ? "border-foreground ring-1 ring-foreground/10"
          : "border-border/20 hover:border-border/60",
      )}
    >
      {children}
    </div>
    <span
      className={cn(
        "text-xs font-semibold tracking-tight transition-colors",
        theme === value ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
      )}
    >
      {label}
    </span>
  </button>
);

export function AppearanceSettings() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
    <div className="flex flex-col gap-[clamp(1rem,1.5vw,1.5rem)]">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <Palette className="size-4 text-primary" />
          Appearance & Theme
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Choose how 0xsignal appears on your device.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        <ThemeCard value="light" label="Light Mode" theme={theme} handleThemeChange={setTheme}>
          <div className="h-full w-full bg-card">
            <div className="h-4 bg-background flex items-center gap-1 px-2">
              <span className="size-1.5 rounded-full bg-red-300" />
              <span className="size-1.5 rounded-full bg-yellow-300" />
              <span className="size-1.5 rounded-full bg-green-300" />
            </div>
            <div className="flex items-center justify-center h-[calc(100%-16px)]">
              <span className="text-sm font-bold text-foreground/90 font-display">Aa</span>
            </div>
          </div>
        </ThemeCard>

        <ThemeCard value="dark" label="Dark Mode" theme={theme} handleThemeChange={setTheme}>
          <div className="dark h-full w-full bg-card">
            <div className="h-4 bg-background flex items-center gap-1 px-2">
              <span className="size-1.5 rounded-full bg-red-500/70" />
              <span className="size-1.5 rounded-full bg-yellow-500/70" />
              <span className="size-1.5 rounded-full bg-green-500/70" />
            </div>
            <div className="flex items-center justify-center h-[calc(100%-16px)]">
              <span className="text-sm font-bold text-foreground/90 font-display">Aa</span>
            </div>
          </div>
        </ThemeCard>

        <ThemeCard value="system" label="System Theme" theme={theme} handleThemeChange={setTheme}>
          <div className="flex h-full w-full">
            <div className="flex-1 bg-card border-r border-border">
              <div className="h-4 bg-background flex items-center gap-1 px-1.5">
                <span className="size-1.5 rounded-full bg-red-300" />
                <span className="size-1.5 rounded-full bg-yellow-300" />
                <span className="size-1.5 rounded-full bg-green-300" />
              </div>
              <div className="flex items-center justify-center h-[calc(100%-16px)]">
                <span className="text-sm font-bold text-foreground/90 font-display">Aa</span>
              </div>
            </div>
            <div className="dark flex-1 bg-card">
              <div className="h-4 bg-background flex items-center gap-1 px-1.5">
                <span className="size-1.5 rounded-full bg-red-500/70" />
                <span className="size-1.5 rounded-full bg-yellow-500/70" />
                <span className="size-1.5 rounded-full bg-green-500/70" />
              </div>
              <div className="flex items-center justify-center h-[calc(100%-16px)]">
                <span className="text-sm font-bold text-foreground/90 font-display">Aa</span>
              </div>
            </div>
          </div>
        </ThemeCard>
      </div>

      <div>
        <div className="space-y-1 mb-3">
          <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <LayoutDashboard className="size-4 text-primary" />
            Dashboard Layout
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Reset the trading dashboard panels to their default positions and sizes.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            useLayoutStore.getState().resetLayout();
            toast.success("Dashboard layout reset");
          }}
        >
          <LayoutDashboard className="size-4" />
          Reset Layout
        </Button>
      </div>
    </div>
  );
}
