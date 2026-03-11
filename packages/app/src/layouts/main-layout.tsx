import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/core/utils/cn";
import { TrendingUp } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [{ path: "/", label: "Watchlist", icon: TrendingUp }] as const;

function LayoutInner({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Desktop Header */}
      <header className="hidden sm:block shrink-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="container-fluid">
          <div className="flex items-center justify-between h-12">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <p className="font-press-start">0xsignal</p>
            </Link>

            <nav className="flex items-center gap-6">
              {NAV_ITEMS.map((item) => {
                const isActive = location.pathname === item.path;
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

      {/* Mobile Header */}
      <header className="sm:hidden shrink-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center justify-between h-12 px-4">
          <Link to="/" className="font-press-start tap-highlight">
            0xsignal
          </Link>
          <div className="flex items-center">
            <ModeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden pb-16 sm:pb-0 relative">
        {children}
      </main>

      {/* Desktop Footer - Minimal */}
      <footer className="hidden sm:block shrink-0 border-t border-border/40 bg-background/80 backdrop-blur-md z-40">
        <div className="flex items-center justify-center text-xs text-muted-foreground py-2 px-4">
          <p className="tabular-nums">Not financial advice</p>
        </div>
      </footer>

      {/* Mobile Navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/40 safe-area-pb transition-all duration-300 ease-premium">
        <div className="flex items-center justify-around h-16 px-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex-1 flex items-center justify-center h-full relative group tap-highlight touch-target-48"
              >
                <div
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 transition-all duration-300 ease-premium w-full",
                    isActive
                      ? "scale-100 translate-y-0"
                      : "scale-95 opacity-50 translate-y-0.5 active:scale-90"
                  )}
                >
                  {/* Active Backdrop Glow */}
                  <div
                    className={cn(
                      "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-secondary/40 rounded-full blur-xl transition-all duration-500",
                      isActive ? "opacity-100 scale-100" : "opacity-0 scale-50"
                    )}
                  />

                  {/* Icon Container */}
                  <div
                    className={cn(
                      "relative z-10 p-1 rounded-xl transition-all duration-300",
                      isActive
                        ? "bg-background/40 shadow-[0_0_15px_-3px_rgba(0,0,0,0.1)] dark:shadow-[0_0_15px_-3px_rgba(255,255,255,0.1)] ring-1 ring-border/50"
                        : "bg-transparent"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-5 h-5 transition-all duration-300",
                        isActive
                          ? "text-foreground stroke-[2.5]"
                          : "text-muted-foreground stroke-[1.5]"
                      )}
                    />
                  </div>

                  {/* Label */}
                  <span
                    className={cn(
                      "relative z-10 text-[10px] font-medium tracking-wide transition-all duration-300",
                      isActive ? "text-foreground font-semibold" : "text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  return <LayoutInner>{children}</LayoutInner>;
}
