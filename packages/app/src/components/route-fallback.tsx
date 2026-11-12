import type { ReactNode } from "react";
import { AssetDetailSkeleton } from "@/components/asset-detail-skeleton";
import { PageLoader } from "@/components/page-loader";
import { Skeleton } from "@/components/ui/skeleton";

export type RouteFallbackKind = "asset-detail" | "page";

/**
 * Generic route shape: the shell header plus page rows, at roughly the height of
 * a real page so the commit does not move the layout.
 */
function PageSkeleton() {
  return (
    <div className="container-fluid flex min-h-full flex-col gap-section py-6">
      <div className="flex items-center justify-between gap-inline">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-7 w-28" />
      </div>
      <Skeleton className="h-9 w-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-11/12" />
        <Skeleton className="h-5 w-4/5" />
      </div>
    </div>
  );
}

interface StatusShellProps {
  children: ReactNode;
}

/** `<output>` names the whole skeleton as one loading region. */
function StatusShell({ children }: StatusShellProps) {
  return (
    <output aria-busy="true" aria-label="Loading page" className="flex flex-col flex-1 min-h-0">
      {children}
    </output>
  );
}

export function RouteFallbackSkeleton({ kind }: { kind: RouteFallbackKind }) {
  return (
    <StatusShell>
      {kind === "asset-detail" ? <AssetDetailSkeleton /> : <PageSkeleton />}
    </StatusShell>
  );
}

/** Cold-start fallback for a page chunk; client navigation keeps the previous screen. */
export function PageHydrateFallback() {
  return <RouteFallbackSkeleton kind="page" />;
}

export function AssetHydrateFallback() {
  return <RouteFallbackSkeleton kind="asset-detail" />;
}

/** The callback performs an exchange before it can render anything of its own. */
export function AuthHydrateFallback() {
  return <PageLoader variant="fullscreen" />;
}
