/**
 * Whether a screen switch should return the scroll container to the top.
 *
 * Only a pathname change is a new screen. Hash-only navigation (e.g. an in-page
 * anchor) keeps `pathname` stable and must preserve the current offset.
 */
export function shouldResetScroll(prevPathname: string, nextPathname: string): boolean {
  return prevPathname !== nextPathname;
}
