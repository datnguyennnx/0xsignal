import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { AppSidePanelProvider } from "@/components/app-side-panel";
import { SidePanelRegion } from "@/components/side-panel";
import { UserNav } from "@/components/user-nav";
import { Surface } from "@/components/surface/surface";
import { cn } from "cn";
const NAV_ITEMS = [
  { path: "/trade", label: "Trade" },
  { path: "/portfolio", label: "Portfolio" },
  { path: "/whales", label: "Whales" },
  { path: "/calendar", label: "Calendar" },
] as const;

export function MainLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <AppSidePanelProvider>
      <div className="flex min-h-dvh w-full bg-transparent">
        <div className="flex flex-1 min-w-0 flex-col p-[var(--app-page-pad)] gap-[var(--app-page-gap)]">
          <a
            href="#main-content"
            className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-[60]"
          >
            <Surface tier="control" radius="control" className="px-4 py-2 text-sm font-medium">
              Skip to content
            </Surface>
          </a>

          <header className="shrink-0 z-50">
            <div className="container-fluid">
              <div className="flex items-center justify-between h-[var(--app-header-height)]">
                <Link
                  to="/"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
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
                          isActive
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground",
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

          <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col min-h-0 min-w-0">
            {children}
          </main>
        </div>

        <SidePanelRegion />
      </div>
    </AppSidePanelProvider>
  );
}
