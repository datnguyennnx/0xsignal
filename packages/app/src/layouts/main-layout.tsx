/**
 * @overview Main Layout Component
 *
 * Defines the primary shell for the application, including the top header, mobile navigation, and common footer.
 * Implements a responsive dual-navigation pattern (header for desktop, bottom bar for mobile).
 *
 * @mechanism
 * - utilizes React Router's useLocation to determine active navigation states.
 * - applies glassmorphism (backdrop-blur) for a premium UI feel.
 */
import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/core/utils/cn";
import { TrendingUp, LineChart } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { path: "/", label: "Market", icon: TrendingUp },
  { path: "/trade", label: "Trade", icon: LineChart },
] as const;

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
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-sm border-t border-border/40 safe-area-pb">
        <div className="flex items-center justify-around h-14 px-1">
          {NAV_ITEMS.map((item) => {
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
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  return <LayoutInner>{children}</LayoutInner>;
}
