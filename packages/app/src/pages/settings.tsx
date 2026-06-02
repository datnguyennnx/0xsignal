/**
 * Settings Page
 *
 * Provides a highly polished, unified settings dashboard.
 * Merges sidebar menu navigation and visual theme switcher panel into a single Card component.
 * Applies responsive styling tokens dynamically using CSS clamp() for fluid, high-fidelity scaling,
 * and bumps text sizes slightly to optimize legibility and layout presence.
 */
import { useEffect } from "react";
import { Palette, Check } from "lucide-react";
import { useTheme } from "@/core/providers/theme-provider";
import { Card } from "@/components/ui/card";
import { cn } from "@/core/utils/cn";

interface ThemeCardProps {
  value: "light" | "dark" | "system";
  label: string;
  theme: string;
  handleThemeChange: (newTheme: "light" | "dark" | "system") => void;
  children: React.ReactNode;
}

// Shared Theme Card component (declared outside render to prevent state reset and satisfy ESLint)
const ThemeCard = ({ value, label, theme, handleThemeChange, children }: ThemeCardProps) => (
  <button
    onClick={() => handleThemeChange(value)}
    className="flex flex-col items-center gap-[clamp(0.375rem,0.5vw,0.5rem)] flex-1 group cursor-pointer w-full text-center"
  >
    <div
      className={cn(
        "relative w-full aspect-[16/10] rounded-xl overflow-hidden border-2 transition-all duration-200 shadow-sm hover:scale-[1.02] hover:shadow-md",
        theme === value
          ? "border-foreground bg-accent/5 ring-1 ring-foreground/5"
          : "border-border/20 hover:border-border/60 bg-background/50"
      )}
    >
      {children}
      {theme === value && (
        <span className="absolute -bottom-1 -right-1 size-5 rounded-full bg-foreground text-background flex items-center justify-center ring-2 ring-background">
          <Check className="size-3" />
        </span>
      )}
    </div>
    <span
      className={cn(
        "text-[clamp(0.6875rem,0.8vw,0.8125rem)] font-semibold tracking-tight transition-colors",
        theme === value ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
      )}
    >
      {label}
    </span>
  </button>
);

export function SettingsPage() {
  const { theme, setTheme } = useTheme();

  // Dynamic document title
  useEffect(() => {
    document.title = "Settings | 0xsignal";
  }, []);

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
  };

  return (
    <div className="container-fluid py-[clamp(1.5rem,3vw,3rem)] space-y-[clamp(1rem,1.5vw,1.5rem)] animate-in fade-in duration-200 ease-premium w-full">
      {/* ─── Compact Header Container ─── */}
      <div className="max-w-4xl mx-auto space-y-[clamp(0.125rem,0.2vw,0.25rem)] px-1">
        <h1 className="text-[clamp(1.125rem,1.5vw,1.5rem)] font-display font-semibold tracking-tight">
          Settings
        </h1>
        <p className="text-[clamp(0.75rem,0.85vw,0.875rem)] text-muted-foreground">
          Configure visual themes and display preferences for your account.
        </p>
      </div>

      {/* ─── Unified Settings Card ─── */}
      <Card className="max-w-4xl mx-auto border border-border/20 shadow-md p-0 overflow-hidden bg-card/40 backdrop-blur-md">
        <div className="grid grid-cols-1 md:grid-cols-12 w-full min-h-[300px]">
          {/* Left Column: Sidebar Menu (Parent Content) */}
          <div className="col-span-1 md:col-span-3 border-b md:border-b-0 md:border-r border-border/10 p-[clamp(0.75rem,1vw,1rem)] flex flex-col gap-1 bg-muted/10">
            <button className="w-full flex items-center gap-[clamp(0.5rem,0.6vw,0.625rem)] px-[clamp(0.625rem,0.8vw,0.875rem)] py-[clamp(0.5rem,0.8vw,0.75rem)] rounded-lg text-left transition-all duration-150 bg-accent text-foreground font-semibold cursor-pointer">
              <Palette className="size-4 shrink-0 text-primary animate-pulse" />
              <div className="flex flex-col min-w-0">
                <span className="text-[clamp(0.6875rem,0.8vw,0.8125rem)] tracking-tight">
                  Appearance & Theme
                </span>
                <span className="text-[clamp(0.5625rem,0.65vw,0.6875rem)] text-muted-foreground/80 truncate">
                  Interface visual styling
                </span>
              </div>
            </button>
          </div>

          {/* Right Column: Active Option Area (Child Content) */}
          <div className="col-span-1 md:col-span-9 p-[clamp(1.25rem,2vw,2rem)] flex flex-col gap-[clamp(1rem,1.5vw,1.5rem)]">
            <div className="space-y-[clamp(0.125rem,0.2vw,0.25rem)]">
              <h2 className="text-[clamp(0.75rem,0.9vw,0.9rem)] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Palette className="size-4 text-foreground" /> Appearance & Theme
              </h2>
              <p className="text-[clamp(0.6875rem,0.8vw,0.8125rem)] text-muted-foreground leading-relaxed">
                Choose how 0xsignal appears on your device. The system setting will match your OS
                preference.
              </p>
            </div>

            {/* Separator line between description and content */}
            <hr className="border-border/10" />

            {/* Theme cards side-by-side inside content pane */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-[clamp(0.75rem,1vw,1.25rem)] w-full pt-1">
              {/* Light Mode */}
              <ThemeCard
                value="light"
                label="Light Mode"
                theme={theme}
                handleThemeChange={handleThemeChange}
              >
                <div className="h-full w-full bg-white">
                  <div className="h-4 bg-gray-50 flex items-center gap-1 px-2 border-b border-gray-100">
                    <span className="size-1.5 rounded-full bg-red-300" />
                    <span className="size-1.5 rounded-full bg-yellow-300" />
                    <span className="size-1.5 rounded-full bg-green-300" />
                  </div>
                  <div className="flex items-center justify-center h-[calc(100%-16px)]">
                    <span className="text-[clamp(0.75rem,1vw,1.125rem)] font-bold text-gray-800/90 font-display">
                      Aa
                    </span>
                  </div>
                </div>
              </ThemeCard>

              {/* Dark Mode */}
              <ThemeCard
                value="dark"
                label="Dark Mode"
                theme={theme}
                handleThemeChange={handleThemeChange}
              >
                <div className="h-full w-full bg-[#1a1a2e]">
                  <div className="h-4 bg-[#151528] flex items-center gap-1 px-2 border-b border-[#252538]">
                    <span className="size-1.5 rounded-full bg-red-500/70" />
                    <span className="size-1.5 rounded-full bg-yellow-500/70" />
                    <span className="size-1.5 rounded-full bg-green-500/70" />
                  </div>
                  <div className="flex items-center justify-center h-[calc(100%-16px)]">
                    <span className="text-[clamp(0.75rem,1vw,1.125rem)] font-bold text-gray-200/90 font-display">
                      Aa
                    </span>
                  </div>
                </div>
              </ThemeCard>

              {/* System Theme */}
              <ThemeCard
                value="system"
                label="System Theme"
                theme={theme}
                handleThemeChange={handleThemeChange}
              >
                <div className="flex h-full w-full">
                  <div className="flex-1 bg-white border-r border-gray-100">
                    <div className="h-4 bg-gray-50 flex items-center gap-1 px-1.5 border-b border-gray-100">
                      <span className="size-1.5 rounded-full bg-red-300" />
                      <span className="size-1.5 rounded-full bg-yellow-300" />
                      <span className="size-1.5 rounded-full bg-green-300" />
                    </div>
                    <div className="flex items-center justify-center h-[calc(100%-16px)]">
                      <span className="text-[clamp(0.75rem,1vw,1.125rem)] font-bold text-gray-800/90 font-display">
                        Aa
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 bg-[#1a1a2e]">
                    <div className="h-4 bg-[#151528] flex items-center gap-1 px-1.5 border-b border-[#252538]">
                      <span className="size-1.5 rounded-full bg-red-500/70" />
                      <span className="size-1.5 rounded-full bg-yellow-500/70" />
                      <span className="size-1.5 rounded-full bg-green-500/70" />
                    </div>
                    <div className="flex items-center justify-center h-[calc(100%-16px)]">
                      <span className="text-[clamp(0.75rem,1vw,1.125rem)] font-bold text-gray-200/90 font-display">
                        Aa
                      </span>
                    </div>
                  </div>
                </div>
              </ThemeCard>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
