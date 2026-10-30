import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "cn";

import { Surface } from "@/components/surface/surface";
import { SurfaceContext } from "@/components/surface/surface-context";

export type ModalDismissReason = "outside-press" | "escape-key" | "close-press" | "focus-out";

type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean, details: { reason: ModalDismissReason }) => void;
  children?: React.ReactNode;
  container?: HTMLElement | null;
  className?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
};

/** Portalled content is never nested in the page's surfaces, whatever triggered it. */
const PORTAL_ANCESTORS = [] as const;

/** Clears dialog popups (`110 + depth*2 + 1`) through depth 19 and stays under popover 200. */
const MODAL_LAYER = 150;

/** Matches `duration-100`: unmount once the leave animation has played. */
const EXIT_MS = 100;

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type ModalRuntime = {
  dismiss: (reason: ModalDismissReason) => void;
  trapTab: (event: KeyboardEvent) => void;
};

const openModals: ModalRuntime[] = [];

function isInsideOpenMenu(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest('[data-slot="dropdown-menu-content"][data-open]') !== null
  );
}

function focusableIn(root: HTMLElement | null): HTMLElement[] {
  if (root === null) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("disabled") && element.closest("[inert]") === null,
  );
}

function focusFirst(root: HTMLElement | null) {
  if (root === null) return;
  const first = focusableIn(root).at(0);
  if (first === undefined) root.focus();
  else first.focus();
}

function trapTab(root: HTMLElement | null, event: KeyboardEvent) {
  if (root === null) return;
  const active = document.activeElement;
  // A menu layered over the modal owns Tab inside itself.
  if (isInsideOpenMenu(active)) return;

  const focusable = focusableIn(root);
  if (focusable.length === 0) {
    event.preventDefault();
    root.focus();
    return;
  }

  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (first === undefined || last === undefined) return;

  if (active === null || !root.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return;
  }
  if (event.shiftKey && (active === first || active === root)) {
    event.preventDefault();
    last.focus();
    return;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function handleDocumentKeyDown(event: KeyboardEvent) {
  if (event.key === "Tab") {
    openModals.at(-1)?.trapTab(event);
    return;
  }
  if (event.key !== "Escape" || event.defaultPrevented) return;
  if (isInsideOpenMenu(event.target)) return;
  const topmost = openModals.at(-1);
  if (topmost === undefined) return;
  event.stopPropagation();
  topmost.dismiss("escape-key");
}

let keyListenerBound = false;

function syncKeyListener() {
  const shouldBind = openModals.length > 0;
  if (shouldBind === keyListenerBound) return;
  if (shouldBind) document.addEventListener("keydown", handleDocumentKeyDown, true);
  else document.removeEventListener("keydown", handleDocumentKeyDown, true);
  keyListenerBound = shouldBind;
}

let scrollLockCount = 0;
let overflowBeforeLock = "";

function lockBodyScroll() {
  if (scrollLockCount === 0) {
    overflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLockCount += 1;
}

function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) document.body.style.overflow = overflowBeforeLock;
}

export function Modal({
  open,
  onOpenChange,
  children,
  container,
  className,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
}: ModalProps) {
  const [mounted, setMounted] = React.useState(open);
  if (open && !mounted) setMounted(true);

  const contentRef = React.useRef<HTMLDialogElement>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);
  const openRef = React.useRef(open);

  // A render write is illegal, yet dismiss must read the prop synchronously.
  React.useLayoutEffect(() => {
    openRef.current = open;
  });

  const dismiss = React.useCallback(
    (reason: ModalDismissReason) => {
      if (!openRef.current) return;
      openRef.current = false;
      onOpenChange(false, { reason });
    },
    [onOpenChange],
  );

  const dismissRef = React.useRef(dismiss);
  React.useEffect(() => {
    dismissRef.current = dismiss;
  }, [dismiss]);

  const [runtime] = React.useState<ModalRuntime>(() => ({
    dismiss: (reason) => {
      dismissRef.current(reason);
    },
    trapTab: (event) => {
      trapTab(contentRef.current, event);
    },
  }));

  React.useEffect(() => {
    if (open) {
      openModals.push(runtime);
      syncKeyListener();
    }
    return () => {
      const index = openModals.lastIndexOf(runtime);
      if (index !== -1) openModals.splice(index, 1);
      syncKeyListener();
    };
  }, [open, runtime]);

  React.useEffect(() => {
    if (open) lockBodyScroll();
    return () => {
      if (open) unlockBodyScroll();
    };
  }, [open]);

  React.useEffect(() => {
    const timer =
      open || !mounted
        ? null
        : window.setTimeout(() => {
            setMounted(false);
          }, EXIT_MS);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [open, mounted]);

  React.useLayoutEffect(() => {
    if (open) {
      const active = document.activeElement;
      const root = contentRef.current;
      // Strict mode replays this effect: never adopt focus that is already ours.
      if (
        restoreFocusRef.current === null &&
        active instanceof HTMLElement &&
        root?.contains(active) !== true
      ) {
        restoreFocusRef.current = active;
      }
      focusFirst(root);
      return;
    }
    restoreFocusRef.current?.focus();
    restoreFocusRef.current = null;
  }, [open]);

  React.useEffect(() => {
    return () => {
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    };
  }, []);

  if (!mounted) return null;

  const target = container ?? (typeof document === "undefined" ? null : document.body);
  if (target === null) return null;

  const stateAttributes = open ? { "data-open": "" } : { "data-closed": "" };

  return createPortal(
    <SurfaceContext.Provider value={PORTAL_ANCESTORS}>
      <div data-slot="modal" {...stateAttributes}>
        <div
          data-slot="modal-backdrop"
          aria-hidden="true"
          className="fixed inset-0 isolate scrim duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          style={{ zIndex: MODAL_LAYER }}
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (openModals.at(-1) !== runtime) return;
            dismiss("outside-press");
          }}
          {...stateAttributes}
        />
        <dialog
          ref={contentRef}
          open
          data-slot="modal-content"
          aria-modal="true"
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          tabIndex={-1}
          className={cn(
            "fixed inset-0 m-auto grid w-full max-w-[calc(100%-2rem)] gap-4 overflow-hidden rounded-[var(--radius-overlay)] border-0 bg-transparent p-4 text-sm text-popover-foreground duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          style={{ zIndex: MODAL_LAYER + 1 }}
          {...stateAttributes}
        >
          <Surface
            tier="solid"
            radius="overlay"
            className="pointer-events-none absolute inset-0 -z-10 glass-no-specular"
          />
          {children}
        </dialog>
      </div>
    </SurfaceContext.Provider>,
    target,
  );
}
