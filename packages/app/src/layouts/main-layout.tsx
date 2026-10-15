import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { UserNav } from "@/components/user-nav";
import { cn } from "cn";
const NAV_ITEMS = [
  { path: "/trade", label: "Trade" },
  { path: "/portfolio", label: "Portfolio" },
  { path: "/calendar", label: "Calendar" },
] as const;

export function MainLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex flex-col min-h-dvh p-4 gap-4 bg-background">
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-[60] focus-visible:rounded-md focus-visible:bg-background focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to content
      </a>

      <header className="shrink-0 z-50">
        <div className="container-fluid">
          <div className="flex items-center justify-between h-12">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <p className="text-base font-semibold tracking-tight">0xsignal</p>
            </Link>

            <nav className="flex items-center gap-6">
              {NAV_ITEMS.map((item) => {
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "text-sm font-medium transition-colors",
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-3">
              <UserNav />
            </div>
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-200 ease-premium"
      >
        {children}
      </main>
    </div>
  );
}
