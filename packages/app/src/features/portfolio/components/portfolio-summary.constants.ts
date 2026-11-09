export const SURFACE = "h-full flex flex-col p-panel gap-stack";

/** Loaded rows and skeleton rows share this stack so their heights cannot drift. */
export const ROW_STACK = "flex flex-col gap-stack";

/** Loaded rows are one `type-data` line box; the skeleton row matches it exactly. */
export const SKELETON_ROW = "flex h-[1.5em] items-center justify-between type-data";

export const SUMMARY_SKELETON_KEYS = Array.from(
  { length: 6 },
  (_, index) => `summary-row-${index}`,
);
