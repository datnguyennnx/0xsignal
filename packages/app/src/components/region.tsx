import type { ReactNode } from "react";
import { cn } from "cn";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import type { AsyncState } from "@/lib/async-state";

interface EmptyCopy {
  title: string;
  description?: string;
  action?: ReactNode;
}

interface ErrorCopy {
  title?: string;
  description?: string;
  retry?: () => void;
  retryLabel?: string;
}

interface RegionProps<T> {
  state: AsyncState<T>;
  children: (data: T) => ReactNode;
  skeleton?: ReactNode;
  empty?: EmptyCopy;
  error?: ErrorCopy;
  className?: string;
  label: string;
  statusLabel?: (state: AsyncState<T>) => string;
}

function renderBranch<T>(
  state: AsyncState<T>,
  children: (data: T) => ReactNode,
  skeleton: ReactNode,
  empty: EmptyCopy | undefined,
  error: ErrorCopy | undefined,
): ReactNode {
  switch (state.status) {
    case "idle":
      return skeleton;
    case "loading":
      if (state.stale === undefined) return skeleton;
      return (
        <div data-state="stale" aria-busy="true">
          {children(state.stale)}
        </div>
      );
    case "ready":
      return children(state.data);
    case "empty":
      return (
        <EmptyState
          title={empty?.title ?? (state.reason === "first-use" ? "Nothing here yet" : "No results")}
          {...(empty?.description === undefined ? {} : { description: empty.description })}
          action={empty?.action}
        />
      );
    case "error":
      return (
        <ErrorState
          {...(error?.title === undefined ? {} : { title: error.title })}
          {...(error?.description === undefined ? {} : { description: error.description })}
          retryAction={error?.retry}
          {...(error?.retryLabel === undefined ? {} : { retryLabel: error.retryLabel })}
        />
      );
    default:
      return null;
  }
}

function announcementFor<T>(
  state: AsyncState<T>,
  label: string,
  statusLabel: ((state: AsyncState<T>) => string) | undefined,
): string {
  if (state.status === "ready") return statusLabel?.(state) ?? `${label}: loaded`;
  if (state.status === "empty") return statusLabel?.(state) ?? `${label}: no results`;
  return "";
}

export function Region<T>({
  state,
  children,
  skeleton = null,
  empty,
  error,
  className,
  label,
  statusLabel,
}: RegionProps<T>) {
  return (
    <section
      aria-label={label}
      aria-busy={state.status === "loading"}
      className={cn("state-enter", className)}
    >
      <output aria-live="polite" aria-atomic="true" className="sr-only">
        {announcementFor(state, label, statusLabel)}
      </output>
      {renderBranch(state, children, skeleton, empty, error)}
    </section>
  );
}
