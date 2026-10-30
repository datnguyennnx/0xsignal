export const SURFACE =
  "h-full flex flex-col p-4 animate-in fade-in duration-200 ease-premium gap-[clamp(0.5rem,1vw,1rem)]";

/** Loaded rows and skeleton rows share this stack so their heights cannot drift. */
export const ROW_STACK = "flex flex-col gap-[clamp(0.5rem,1vw,1rem)]";

/** Loaded rows are one `text-compact` line box; the skeleton row matches it exactly. */
export const SKELETON_ROW =
  "flex h-[1.5em] items-center justify-between text-[length:var(--text-compact)]";

export const SUMMARY_SKELETON_KEYS = Array.from(
  { length: 8 },
  (_, index) => `summary-row-${index}`,
);
