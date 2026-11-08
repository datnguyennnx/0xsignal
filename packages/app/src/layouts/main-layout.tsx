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
import { preloadRoute } from "@/lib/preload-routes";

export function MainLayout({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <AppSidePanelProvider>
      <div className="flex min-h-dvh w-full bg-transparent">
        <AmbientCanvas />
        <div
          data-shell-content
          className="flex h-dvh flex-1 min-w-0 flex-col p-(--app-page-pad) gap-(--app-page-gap)"
        >
          <a
            href="#main-content"
            className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-4 focus-visible:left-4 focus-visible:z-(--z-panel)"
          >
            <Surface
              tier="control"
              radius="control"
              className="px-(--control-px) py-1 type-control font-medium"
            >
              Skip to content
            </Surface>
          </a>

          <header className="sticky top-0 z-(--z-header) shrink-0">
            <div className="container-fluid">
              <div className="flex items-center justify-between gap-inline min-w-0 h-(--app-header-height)">
                <Link to="/" className="flex items-center gap-1 hover:opacity-80 motion-fade">
                  <p className="type-title font-semibold tracking-tight">0xsignal</p>
                </Link>

                <nav className="hidden md:flex items-center gap-stack">
                  {NAV_ROUTES.map((item) => {
                    const isActive = location.pathname.startsWith(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onMouseEnter={() => {
                          preloadRoute(item.path);
                        }}
                        onFocus={() => {
                          preloadRoute(item.path);
                        }}
                        className={`type-control font-medium motion-control ${
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

                <div className="row-actions shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="outline" size="icon" data-dense className="md:hidden" />
                      }
                    >
                      <Menu className="size-icon" />
                      <span className="sr-only">Open navigation</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={10}>
                      {NAV_ROUTES.map((item) => {
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                          <DropdownMenuItem
                            key={item.path}
                            render={<Link to={item.path} />}
                            onMouseEnter={() => {
                              preloadRoute(item.path);
                            }}
                            onFocus={() => {
                              preloadRoute(item.path);
                            }}
                            className={`px-2 py-1 type-label font-medium motion-control ${
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

          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto"
          >
            {children}
          </main>
        </div>

        <SidePanelRegion />
      </div>
    </AppSidePanelProvider>
  );
}
