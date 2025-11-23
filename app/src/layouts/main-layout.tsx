import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Sticky Header */}
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-foreground rounded-md flex items-center justify-center">
                <span className="text-background font-bold text-sm">0x</span>
              </div>
              <span className="font-bold text-lg">Signal</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content - flex-1 to push footer down */}
      <main className="flex-1 container mx-auto px-6 py-8">{children}</main>

      {/* Footer - always at bottom */}
      <footer className="border-t bg-background">
        <div className="container mx-auto px-6 py-4">
          <p className="text-xs text-center text-muted-foreground">
            Powered by quantitative analysis • Data from CoinGecko
          </p>
        </div>
      </footer>
    </div>
  );
}
