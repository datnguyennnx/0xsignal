/**
 * Reading each token through its own `getComputedStyle` call forces a style recalc per token;
 * token consumers share this helper so a theme re-resolve is a single read.
 */

export function readRootStyle(): CSSStyleDeclaration | null {
  if (typeof document === "undefined") return null;
  return getComputedStyle(document.documentElement);
}

export function readRootToken(token: string): string {
  return readRootStyle()?.getPropertyValue(token).trim() ?? "";
}
