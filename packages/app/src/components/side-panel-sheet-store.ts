/** `md` breakpoint: the panel is a complementary region above it, a sheet below. */
const IS_SHEET_QUERY = "(min-width: 48rem)";

export function subscribeIsSheet(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const query = window.matchMedia(IS_SHEET_QUERY);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

export function getIsSheetSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return !window.matchMedia(IS_SHEET_QUERY).matches;
}
