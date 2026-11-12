import { type ReactNode } from "react";
import { Link, useLocation } from "react-router";
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
import { NAV_ROUTES, type NavRoute } from "@/lib/routes";
import { usePreloadOnIntent } from "@/lib/preload-routes";

interface NavItemLinkProps {
  item: NavRoute;
  active: boolean;
  variant: "desktop" | "menu";
  onIntent: (event: { currentTarget: HTMLElement }) => void;
}

function NavItemLink({ item, active, variant, onIntent }: NavItemLinkProps) {
  const stateClass = active
    ? "font-bold text-foreground"
    : "font-semibold text-muted-foreground hover:text-foreground";

  if (variant === "menu") {
    return (
      <DropdownMenuItem
        render={<Link to={item.path} />}
        data-preload-path={item.path}
        onMouseEnter={onIntent}
        onFocus={onIntent}
        onPointerDown={onIntent}
        aria-current={active ? "page" : undefined}
        className={`focus-ring type-data motion-control ${stateClass}`}
      >
        {item.navLabel}
      </DropdownMenuItem>
    );
  }

  return (
    <Link
      to={item.path}
      data-preload-path={item.path}
      onMouseEnter={onIntent}
      onFocus={onIntent}
      onPointerDown={onIntent}
      aria-current={active ? "page" : undefined}
      className={`focus-ring type-title motion-control whitespace-nowrap ${stateClass}`}
    >
      {item.navLabel}
    </Link>
  );
}

export function MainLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const onIntent = usePreloadOnIntent();

  return (
    <AppSidePanelProvider>
      <div className="flex min-h-dvh w-full">
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

          <header className="container-fluid sticky top-0 z-(--z-header) shrink-0 flex items-center justify-between gap-inline min-w-0 h-(--app-header-height)">
            <Link to="/" className="flex items-center gap-1 hover:opacity-80 motion-fade">
              <p className="type-title font-semibold tracking-tight">0xsignal</p>
            </Link>

            <nav className="hidden md:flex items-center gap-stack">
              {NAV_ROUTES.map((item) => (
                <NavItemLink
                  key={item.path}
                  item={item}
                  active={pathname.startsWith(item.path)}
                  variant="desktop"
                  onIntent={onIntent}
                />
              ))}
            </nav>

            <div className="row-actions shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" size="icon" data-dense className="md:hidden" />}
                >
                  <Menu className="size-icon" />
                  <span className="sr-only">Open navigation</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={10}>
                  {NAV_ROUTES.map((item) => (
                    <NavItemLink
                      key={item.path}
                      item={item}
                      active={pathname.startsWith(item.path)}
                      variant="menu"
                      onIntent={onIntent}
                    />
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <UserNav />
            </div>
          </header>

          <main
            id="main-content"
            tabIndex={-1}
            className="scrollbar-gutter-stable flex-1 flex flex-col min-h-0 min-w-0 overflow-y-auto"
          >
            {children}
          </main>
        </div>

        <SidePanelRegion />
      </div>
    </AppSidePanelProvider>
  );
}
