import { cn } from "cn";

import { STATE_ART_URL } from "@/lib/state-art-url";

type StateArtSize = "sm" | "md" | "lg";

// The asset carries transparent padding, so the box is sized up to let the
// character read at brand scale. `vmin` tracks the smaller viewport axis, so the
// art stays proportionate on both short landscape and tall portrait screens.
const SIZE_CLASS: Record<StateArtSize, string> = {
  sm: "w-[clamp(3rem,6vmin,4.5rem)]",
  md: "w-[clamp(7rem,18vmin,13rem)]",
  lg: "w-[clamp(10rem,26vmin,19rem)]",
};

interface StateArtProps {
  size?: StateArtSize;
  className?: string;
}

// The 500×500 intrinsic box reserves space before the async decode, so a slow
// image never collapses the error screen into a width×0 strip.
export function StateArt({ size = "md", className }: StateArtProps) {
  return (
    <img
      src={STATE_ART_URL}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      width={500}
      height={500}
      style={{ aspectRatio: "500 / 500" }}
      className={cn("h-auto object-contain select-none", SIZE_CLASS[size], className)}
    />
  );
}
