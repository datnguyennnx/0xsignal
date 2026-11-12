import type { ReactNode } from "react";

type PageShellVariant = "flow" | "fill";

const FRAME: Record<PageShellVariant, string> = {
  // Main scrolls the document-style page.
  flow: "container-fluid flex flex-col gap-section",
  // The viewport owns the height; each page's table/summary is its one scroller.
  fill: "container-fluid flex flex-1 min-h-0 flex-col gap-section",
};

interface PageShellProps {
  readonly title: string;
  readonly variant: PageShellVariant;
  readonly children: ReactNode;
}

/** The one page frame shared by the portfolio, whales, and whale-detail routes. */
export function PageShell({ title, variant, children }: PageShellProps) {
  return (
    <div className={FRAME[variant]}>
      <h1 className="sr-only">{title}</h1>
      {children}
    </div>
  );
}
