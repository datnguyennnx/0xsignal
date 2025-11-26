import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/core/utils/cn";

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { path: "/", label: "Dashboard" },
  { path: "/market-depth", label: "Market Depth" },
  { path: "/buyback", label: "Buyback" },
] as const;

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Minimalist Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand */}
            <Link
              to="/"
              className="text-xl font-semibold tracking-tight hover:opacity-80 transition-opacity"
            >
              0xSignal
            </Link>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
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

            {/* Theme Toggle */}
            <ModeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto py-6 sm:py-8">{children}</main>

      {/* Minimalist Footer */}
      <footer>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} 0xSignal. Quantitative crypto analysis.
            </p>
            <p className="text-xs text-muted-foreground">Data provided by CoinGecko, DefiLlama</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
