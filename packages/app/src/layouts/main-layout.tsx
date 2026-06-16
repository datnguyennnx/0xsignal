import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { UserNav } from "@/components/user-nav";
import { cn } from "@/core/utils/cn";
const NAV_ITEMS = [
  { path: "/trade", label: "Trade" },
  { path: "/portfolio", label: "Portfolio" },
] as const;

export function MainLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex flex-col min-h-screen p-4 gap-4 bg-background">
      <header className="shrink-0 z-50 bg-background/60 backdrop-blur-md">
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
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
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

      <main className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-200 ease-premium">
        {children}
      </main>
    </div>
  );
}
