import type { JSX } from "react";
import { ChevronDown, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  CATEGORY_LABEL,
  CATEGORY_OPTIONS,
  isCategoryFilterValue,
  type CalendarCategoryFilterValue,
} from "./calendar-filters-model";

export type { CalendarCategoryFilterValue } from "./calendar-filters-model";

export interface CalendarCategoryFilterProps {
  value: CalendarCategoryFilterValue;
  onChange: (v: CalendarCategoryFilterValue) => void;
}

export function CalendarCategoryFilter({
  value,
  onChange,
}: CalendarCategoryFilterProps): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className="gap-1" />}>
        <Filter className="size-icon-sm opacity-60" />
        {CATEGORY_LABEL[value]}
        <ChevronDown className="size-icon-sm opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next: string) => {
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
