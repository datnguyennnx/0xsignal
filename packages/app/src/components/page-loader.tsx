import { cn } from "cn";

interface PageLoaderProps {
  variant?: "page" | "fullscreen";
}

export function PageLoader({ variant = "page" }: PageLoaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        variant === "fullscreen" ? "min-h-dvh" : "min-h-[clamp(20rem,50dvh,40rem)]",
      )}
    >
      <div className="size-4 border-2 border-foreground/25 rounded-full animate-spin" />
    </div>
  );
}
