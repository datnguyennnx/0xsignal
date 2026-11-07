import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { AppSidePanelProvider } from "@/components/app-side-panel";
import { SidePanelRegion } from "@/components/side-panel";
import { UserNav } from "@/components/user-nav";
import { AmbientCanvas } from "@/components/surface/ambient-canvas";
import { Surface } from "@/components/surface/surface";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NAV_ROUTES } from "@/lib/routes";

export function MainLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <AppSidePanelProvider>
      <div className="flex min-h-dvh w-full bg-transparent">
        <AmbientCanvas />
        <div className="flex flex-1 min-w-0 flex-col p-[var(--app-page-pad)] gap-[var(--app-page-gap)]">
          <a
            href="#main-content"
            className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-[60]"
          >
            <Surface tier="control" radius="control" className="px-4 py-2 text-sm font-medium">
              Skip to content
            </Surface>
          </a>

          <header
            className="shrink-0 z-50 tier-control"
            data-material="glass"
            data-thickness="regular"
            data-glass-depth="0"
          >
            <div className="container-fluid">
              <div className="flex items-center justify-between gap-3 min-w-0 h-[var(--app-header-height)]">
                <Link
                  to="/"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <p className="text-base font-semibold tracking-tight">0xsignal</p>
                </Link>

                <nav className="hidden md:flex items-center gap-6">
                  {NAV_ROUTES.map((item) => {
                    const isActive = location.pathname.startsWith(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`text-sm font-medium transition-colors ${
                          isActive
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {item.navLabel}
                      </Link>
                    );
                  })}
                </nav>

                <div className="flex items-center gap-3 shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="outline" size="icon" className="size-8 md:hidden" />}
                    >
                      <Menu className="size-4" />
                      <span className="sr-only">Open navigation</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={10}>
                      {NAV_ROUTES.map((item) => {
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                          <DropdownMenuItem
                            key={item.path}
                            render={<Link to={item.path} />}
                            className={`px-2.5 py-2 text-xs font-medium transition-colors ${
                              isActive
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {item.navLabel}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>

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
