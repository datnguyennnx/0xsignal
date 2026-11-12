import { Palette, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAppStore } from "@/stores/use-app-store";
import { cn } from "cn";
import { useLayoutStore } from "@/stores/use-layout-store";
import { SettingsSection } from "./settings-section";

interface ThemePreviewProps {
  theme: "light" | "dark";
  className?: string;
}

const ThemePreview = ({ theme, className }: ThemePreviewProps) => (
  <div className={cn(theme, "bg-card p-2", className)}>
    <div className="flex h-full flex-col gap-1 rounded-control bg-background/60 p-2">
      <div className="flex items-center gap-1">
        <span className="size-1 rounded-full bg-loss/70" />
        <span className="size-1 rounded-full bg-warn/70" />
        <span className="size-1 rounded-full bg-gain/70" />
        <span className="ml-auto h-1 w-6 rounded-full bg-foreground/20" />
      </div>
      <span className="h-1 w-3/4 rounded-full bg-foreground/25" />
      <span className="h-1 w-full rounded-full bg-foreground/15" />
      <span className="h-1 w-2/3 rounded-full bg-foreground/15" />
      <span className="mt-auto h-4 w-full rounded-chip bg-secondary" />
    </div>
  </div>
);

interface ThemeCardProps {
  value: "light" | "dark" | "system";
  label: string;
  theme: string;
  handleThemeChange: (newTheme: "light" | "dark" | "system") => void;
  children: React.ReactNode;
}

const ThemeCard = ({ value, label, theme, handleThemeChange, children }: ThemeCardProps) => {
  const checked = theme === value;
  return (
    <label className="group flex w-full max-w-64 cursor-pointer flex-col items-center gap-stack justify-self-center text-center">
      <input
        type="radio"
        name="theme"
        value={value}
        checked={checked}
        onChange={() => {
          handleThemeChange(value);
        }}
        className="peer sr-only"
      />
      <div
        className={cn(
          "relative aspect-[16/10] w-full overflow-hidden rounded-panel border transition-[background-color,box-shadow,border-color,transform] duration-(--dur-fast) ease-standard peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
          checked
            ? "border-(--option-card-active-border) bg-(--option-card-active-bg) shadow-(--shadow-e2)"
            : "border-border/25 shadow-(--shadow-e1) hover:border-border/60 hover:shadow-(--shadow-e2)",
        )}
      >
        {children}
      </div>
      <span
        className={cn(
          "type-label font-semibold text-muted-foreground transition-colors group-hover:text-foreground",
          checked && "text-foreground",
        )}
      >
        {label}
      </span>
    </label>
  );
};

function ThemeCards() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
    <div className="grid w-full grid-cols-1 gap-stack sm:grid-cols-3">
      <ThemeCard value="light" label="Light Mode" theme={theme} handleThemeChange={setTheme}>
        <ThemePreview theme="light" className="h-full w-full" />
      </ThemeCard>
      <ThemeCard value="dark" label="Dark Mode" theme={theme} handleThemeChange={setTheme}>
        <ThemePreview theme="dark" className="h-full w-full" />
      </ThemeCard>
      <ThemeCard value="system" label="System Theme" theme={theme} handleThemeChange={setTheme}>
        <div className="flex h-full w-full">
          <ThemePreview theme="light" className="flex-1 border-r border-border" />
          <ThemePreview theme="dark" className="flex-1" />
        </div>
      </ThemeCard>
    </div>
  );
}

export function AppearanceSettings() {
  return (
    <SettingsSection>
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-inline type-title font-semibold text-foreground">
          <Palette className="size-icon text-primary" />
          Appearance & Theme
        </h3>
        <p className="type-body text-muted-foreground">
          Choose how 0xsignal appears on your device.
        </p>
      </div>

      <ThemeCards />

      <div className="flex flex-col gap-stack">
        <div className="flex flex-col gap-1">
          <h4 className="flex items-center gap-inline type-title font-semibold text-foreground">
            <LayoutDashboard className="size-icon text-primary" />
            Dashboard Layout
          </h4>
          <p className="type-body text-muted-foreground">
            Reset the trading dashboard panels to their default positions and sizes.
          </p>
        </div>
        <Button
          variant="outline"
          className="self-start"
          onClick={() => {
            useLayoutStore.getState().resetLayout();
            toast.success("Dashboard layout reset");
          }}
        >
          <LayoutDashboard className="size-icon" />
          Reset Layout
        </Button>
      </div>
    </SettingsSection>
  );
}
