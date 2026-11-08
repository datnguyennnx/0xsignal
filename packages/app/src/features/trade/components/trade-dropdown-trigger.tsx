import type { RefObject } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
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
    <Button
      type="button"
      ref={triggerRef}
      variant="ghost"
      size="auto"
      className="flex items-center gap-1 cursor-pointer transition-colors hover:bg-muted/40"
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
          <span className="type-title font-semibold text-foreground tabular-nums">
            {displayLabel}
          </span>
        ) : (
          <>
            <span className="type-title font-semibold text-foreground tabular-nums">
              {symbolParts.base}
            </span>
            {symbolParts.quote !== "" && (
              <span className="type-title font-semibold text-foreground tabular-nums">
                -{symbolParts.quote}
              </span>
            )}
          </>
        )}
      </span>
      <ChevronDown
        className={cn(
          "size-icon text-muted-foreground transition-transform shrink-0",
          isOpen && "rotate-180",
        )}
      />
    </Button>
  );
}
