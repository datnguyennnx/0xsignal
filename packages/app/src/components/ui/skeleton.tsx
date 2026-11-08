import { cn } from "cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("motion-fade animate-pulse rounded-control bg-muted/60", className)}
      {...props}
    />
  );
}

export { Skeleton };
