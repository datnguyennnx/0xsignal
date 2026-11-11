import { cn } from "cn";

/* oxlint-disable jsx-a11y/prefer-tag-over-role -- a fullscreen status region is not a form output */

interface PageLoaderProps {
  variant?: "page" | "fullscreen";
}

export function PageLoader({ variant = "page" }: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={cn(
        "flex flex-col items-center justify-center gap-2",
        variant === "fullscreen" ? "min-h-dvh" : "flex-1 min-h-full py-10",
      )}
    >
      <div
        aria-hidden="true"
        className="size-4 border-2 border-foreground/25 rounded-full animate-spin motion-reduce:animate-none"
      />
      <span className="type-control text-muted-foreground">Loading…</span>
    </div>
  );
}
