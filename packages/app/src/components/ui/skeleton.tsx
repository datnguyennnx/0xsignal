import { cn } from "cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "content-fade animate-pulse motion-reduce:animate-none rounded-control bg-muted/60",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
