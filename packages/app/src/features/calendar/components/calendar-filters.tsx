import type { JSX } from "react";
import type { CalendarCategory } from "@0xsignal/shared";
import { ChevronDown, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type CalendarCategoryFilterValue = "all" | CalendarCategory;

export interface CalendarCategoryFilterProps {
  value: CalendarCategoryFilterValue;
  onChange(v: CalendarCategoryFilterValue): void;
}

const CATEGORY_OPTIONS: CalendarCategoryFilterValue[] = ["all", "macro", "fx", "crypto"];

function isCategoryFilterValue(value: string): value is CalendarCategoryFilterValue {
  return value === "all" || value === "macro" || value === "fx" || value === "crypto";
}

const CATEGORY_LABEL: Record<CalendarCategoryFilterValue, string> = {
  all: "All",
  macro: "Macro",
  crypto: "Crypto",
  fx: "FX",
};

export function CalendarCategoryFilter({
  value,
  onChange,
}: CalendarCategoryFilterProps): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 border-border/40">
          <Filter className="size-3.5 opacity-60" />
          {CATEGORY_LABEL[value]}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            if (isCategoryFilterValue(next)) onChange(next);
          }}
        >
          {CATEGORY_OPTIONS.map((category) => (
            <DropdownMenuRadioItem key={category} value={category}>
              {CATEGORY_LABEL[category]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
