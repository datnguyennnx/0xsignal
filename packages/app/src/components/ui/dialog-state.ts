/** Base UI owns Escape for the topmost modal; the side panel reads this to yield the key. */
export function isDialogOpen(): boolean {
  return document.querySelector('[data-slot="dialog-content"][data-open]') !== null;
}
