/**
 * @overview Main Layout Component
 *
 * Defines the primary shell for the application with separate desktop and mobile navigators.
 * Uses the useBreakpoint hook for conditional rendering — no mobile DOM on desktop and vice versa.
 */
import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/core/utils/cn";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { TrendingUp, LineChart, Settings } from "lucide-react";

const DESKTOP_NAV_ITEMS = [
  { path: "/", label: "Market" },
  { path: "/trade", label: "Trade" },
] as const;

const MOBILE_NAV_ITEMS = [
  { path: "/", label: "Market", icon: TrendingUp },
  { path: "/trade", label: "Trade", icon: LineChart },
  { path: "/settings", label: "Settings", icon: Settings },
] as const;

function DesktopShell({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <>
      <header className="shrink-0 z-50 bg-background/80 backdrop-blur-md">
        <div className="container-fluid">
          <div className="flex items-center justify-between h-12">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <p className="font-press-start">0xsignal</p>
            </Link>

            <nav className="flex items-center gap-6">
              {DESKTOP_NAV_ITEMS.map((item) => {
                const isActive =
                  item.path === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "text-sm font-medium transition-colors",
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center">
              <ModeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">{children}</main>
    </>
  );
}

function MobileShell({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <>
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden pb-16 relative">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-sm border-t border-border/40 safe-area-pb">
        <div className="flex items-center justify-around h-14 px-1">
          {MOBILE_NAV_ITEMS.map((item) => {
            const isActive =
              item.path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex-1 flex flex-col items-center justify-center h-full gap-0.5 tap-highlight"
              >
                <Icon
                  className={cn("w-5 h-5", isActive ? "text-foreground" : "text-muted-foreground")}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </span>
                <div
                  className={cn(
                    "absolute bottom-0 w-8 h-0.5 rounded-full transition-colors",
                    isActive ? "bg-foreground" : "bg-transparent"
                  )}
                />
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {isMobile ? <MobileShell>{children}</MobileShell> : <DesktopShell>{children}</DesktopShell>}
    </div>
  );
}
