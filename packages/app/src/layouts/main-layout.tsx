import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/core/utils/cn";
import { TrendingUp, Coins, Layers, RefreshCw, Landmark } from "lucide-react";
import { invalidateAll } from "@/core/cache/effect-cache";
import { Effect } from "effect";
import { AppLayer } from "@/core/runtime/effect-runtime";
import { FreshnessProvider, useFreshness } from "@/core/cache/freshness-context";

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { path: "/", label: "Signals", icon: TrendingUp },
  { path: "/buyback", label: "Revenue", icon: Coins },
  { path: "/treasury", label: "Treasury", icon: Landmark },
  { path: "/market-depth", label: "Structure", icon: Layers },
] as const;

/** Format time ago as simple text */
const formatTimeAgo = (date: Date): string => {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
};

function LayoutInner({ children }: LayoutProps) {
  const location = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { getLatestFetch } = useFreshness();
  const [timeAgo, setTimeAgo] = useState<string>("");

  const handleRefreshCache = async () => {
    setIsRefreshing(true);
    try {
      await Effect.runPromise(invalidateAll().pipe(Effect.provide(AppLayer)));
      window.location.reload();
    } catch {
      setIsRefreshing(false);
    }
  };

  // Update time ago every 30 seconds
  useEffect(() => {
    const update = () => {
      const latestFetch = getLatestFetch();
      setTimeAgo(latestFetch ? formatTimeAgo(latestFetch) : "—");
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [getLatestFetch]);

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
            <div className="flex items-center gap-4">
              <p>© {new Date().getFullYear()} 0xSignal</p>
              <p className="text-muted-foreground">Not financial advice</p>
            </div>
            <div className="flex items-center gap-4">
              <p className="tabular-nums">
                Last update: <span className="text-foreground/80">{timeAgo}</span>
              </p>
              <p>Data: CoinGecko · DefiLlama · Binance</p>
            </div>
          </div>
        </div>
      </footer>

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
  return (
    <FreshnessProvider>
      <LayoutInner>{children}</LayoutInner>
    </FreshnessProvider>
  );
}
