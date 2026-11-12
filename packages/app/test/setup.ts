import { Window } from "happy-dom";

const browser = new Window({ url: "http://localhost/" });

const globals = {
  window: browser,
  document: browser.document,
  navigator: browser.navigator,
  location: browser.location,
  history: browser.history,
  localStorage: browser.localStorage,
  sessionStorage: browser.sessionStorage,
  Node: browser.Node,
  Element: browser.Element,
  HTMLElement: browser.HTMLElement,
  HTMLInputElement: browser.HTMLInputElement,
  Event: browser.Event,
  CustomEvent: browser.CustomEvent,
  MouseEvent: browser.MouseEvent,
  KeyboardEvent: browser.KeyboardEvent,
  MutationObserver: browser.MutationObserver,
  ResizeObserver: browser.ResizeObserver,
  DOMRect: browser.DOMRect,
  getComputedStyle: browser.getComputedStyle.bind(browser),
  requestAnimationFrame: browser.requestAnimationFrame.bind(browser),
  cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser),
};

Object.assign(globalThis, globals);

export const hasDom = typeof document !== "undefined";

/** Undo a test's fake DOM install; deleting the global leaks into later files. */
export const restoreDomGlobals = (): void => {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: browser.document,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: browser,
  });
};
