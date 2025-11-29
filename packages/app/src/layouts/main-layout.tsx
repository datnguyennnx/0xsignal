// Main Layout - Mobile-first with bottom navigation

import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/core/utils/cn";
import { BarChart3, Wallet, Home } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { path: "/", label: "Signals", icon: Home, desc: "Trading signals" },
  { path: "/market-depth", label: "Depth", icon: BarChart3, desc: "Market heatmap & liquidations" },
  { path: "/buyback", label: "Buyback", icon: Wallet, desc: "Protocol revenue yields" },
] as const;

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Desktop Header */}
      <header className="hidden sm:block sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-lg font-semibold tracking-tight">0xSignal</span>
              <span className="text-xs text-muted-foreground hidden lg:inline">
                Quantitative Crypto Analysis
              </span>
            </Link>

            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={item.desc}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded transition-colors",
                      isActive
                        ? "text-foreground bg-muted"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <ModeToggle />
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="sm:hidden sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center justify-between h-12 px-4">
          <Link to="/" className="text-base font-semibold tracking-tight">
            0xSignal
          </Link>
          <ModeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-16 sm:pb-0">{children}</main>

      {/* Mobile Bottom Navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border/40 safe-area-pb">
        <div className="flex items-center justify-around h-14">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-label={item.desc}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Footer */}
      <footer className="hidden sm:block border-t border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>© {new Date().getFullYear()} 0xSignal</span>
              <span className="hidden md:inline">·</span>
              <span className="hidden md:inline">
                Multi-strategy signal analysis for crypto assets
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span>Data: CoinGecko · DefiLlama · Binance</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
