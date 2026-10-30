import type { RefObject } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";
import { splitDisplaySymbol } from "../utils/display-symbol";

const LOGO_SLOT_CLASS = "w-5 h-5 shrink-0";
const LABEL_SLOT_CLASS = "flex items-baseline min-w-[5.5rem]";

interface TradeDropdownTriggerProps {
  triggerRef: RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onToggle: () => void;
  onPrefetch?: (() => void) | undefined;
  displayLabel: string;
  displaySymbol?: string | undefined;
  logoUrl?: string | undefined;
  contentId: string;
}

export function TradeDropdownTrigger({
  triggerRef,
  isOpen,
  onToggle,
  onPrefetch,
  displayLabel,
  displaySymbol,
  logoUrl,
  contentId,
}: TradeDropdownTriggerProps) {
  const symbolParts =
    displaySymbol !== undefined && displaySymbol !== "" ? splitDisplaySymbol(displaySymbol) : null;

  return (
    <button
      type="button"
      ref={triggerRef}
      className="flex items-center gap-[clamp(0.2rem,0.4vw,0.375rem)] cursor-pointer px-2 py-1 rounded transition-colors hover:bg-muted/30"
      onClick={onToggle}
      onMouseEnter={onPrefetch}
      onFocus={onPrefetch}
      aria-expanded={isOpen}
      aria-controls={contentId}
      aria-label={`Select market, current ${displayLabel}`}
    >
      {logoUrl !== undefined && logoUrl !== "" ? (
        <img
          src={logoUrl}
          alt=""
          className={cn(LOGO_SLOT_CLASS, "rounded-full")}
          loading="eager"
          decoding="async"
        />
      ) : (
        <span aria-hidden="true" className={cn(LOGO_SLOT_CLASS, "rounded-full bg-muted/60")} />
      )}
      <span className={LABEL_SLOT_CLASS}>
        {symbolParts === null ? (
          <span className="text-lg sm:text-xl font-semibold text-foreground tabular-nums">
            {displayLabel}
          </span>
        ) : (
          <>
            <span className="text-lg sm:text-xl font-semibold text-foreground tabular-nums">
              {symbolParts.base}
            </span>
            {symbolParts.quote !== "" && (
              <span className="text-lg sm:text-xl font-semibold text-foreground tabular-nums">
                -{symbolParts.quote}
              </span>
            )}
          </>
        )}
      </span>
      <ChevronDown
        className={cn(
          "w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0",
          isOpen && "rotate-180",
        )}
      />
    </button>
  );
}
