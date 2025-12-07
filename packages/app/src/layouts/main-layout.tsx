import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/core/utils/cn";
import { TrendingUp, Coins, Layers, RefreshCw, Landmark } from "lucide-react";
import { invalidateAll } from "@/core/cache/effect-cache";
import { Effect } from "effect";
import { AppLayer } from "@/core/runtime/effect-runtime";

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { path: "/", label: "Signals", icon: TrendingUp },
  { path: "/buyback", label: "Revenue", icon: Coins },
  { path: "/treasury", label: "Treasury", icon: Landmark },
  { path: "/market-depth", label: "Depth", icon: Layers },
] as const;

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshCache = async () => {
    setIsRefreshing(true);
    try {
      await Effect.runPromise(invalidateAll().pipe(Effect.provide(AppLayer)));
      window.location.reload();
    } catch {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
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

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefreshCache}
                disabled={isRefreshing}
                title="Refresh cache"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
              <ModeToggle />
            </div>
          </div>
        </div>
      </header>

      <header className="sm:hidden shrink-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center justify-between h-12 px-4">
          <Link to="/" className="font-press-start tap-highlight">
            0xsignal
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefreshCache}
              disabled={isRefreshing}
              aria-label="Refresh data"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-h-0 overflow-hidden pb-16 sm:pb-0 relative">
        {children}
      </main>

      <footer className="hidden sm:block shrink-0 border-t border-border/40 bg-background/80 backdrop-blur-md z-40">
        <div className="container-fluid py-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>© {new Date().getFullYear()} 0xSignal</span>
            <span>Data: CoinGecko · DefiLlama · Binance</span>
          </div>
        </div>
      </footer>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border/40 safe-area-pb">
        <div className="flex items-center justify-around h-16">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all tap-highlight touch-target-48",
                  isActive ? "text-foreground" : "text-muted-foreground active:text-foreground"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-6 rounded-full transition-colors",
                    isActive && "bg-secondary"
                  )}
                >
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
