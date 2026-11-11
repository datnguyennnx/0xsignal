import { useEffect, useState, type ReactNode } from "react";
import { AssetDetailSkeleton } from "@/components/asset-detail-skeleton";
import {
  pickRouteFallback,
  startRouteFallbackDelay,
  type RouteFallbackKind,
} from "@/components/route-fallback-logic";
import { Skeleton } from "@/components/ui/skeleton";

/* oxlint-disable jsx-a11y/prefer-tag-over-role -- a route-wide status region is not a form output */

function useRouteFallbackVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(
    () =>
      startRouteFallbackDelay(() => {
        setVisible(true);
      }),
    [],
  );
  return visible;
}

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

/** `role="status"` names the whole skeleton as one loading region. */
function StatusShell({ children }: StatusShellProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading page"
      className="flex flex-col flex-1 min-h-0"
    >
      {children}
    </div>
  );
}

export function RouteFallbackSkeleton({ kind }: { kind: RouteFallbackKind }) {
  return (
    <StatusShell>
      {kind === "asset-detail" ? <AssetDetailSkeleton /> : <PageSkeleton />}
    </StatusShell>
  );
}

export function RouteFallback({ pathname }: { pathname: string }) {
  const visible = useRouteFallbackVisible();
  if (!visible) return null;
  return <RouteFallbackSkeleton kind={pickRouteFallback(pathname)} />;
}
