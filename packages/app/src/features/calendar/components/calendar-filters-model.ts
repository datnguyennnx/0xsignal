import type { CalendarCategory } from "@0xsignal/shared";

export type CalendarCategoryFilterValue = "all" | CalendarCategory;

export const CATEGORY_LABEL: Record<CalendarCategoryFilterValue, string> = {
  all: "All",
  macro: "Macro",
  fx: "FX",
  crypto: "Crypto",
};

/** The map is the owner: options and the type guard are derived from it. */
export function isCategoryFilterValue(value: string): value is CalendarCategoryFilterValue {
  return Object.hasOwn(CATEGORY_LABEL, value);
}

export const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABEL).filter((key) =>
  isCategoryFilterValue(key),
);

export function categoryLabel(value: CalendarCategoryFilterValue): string {
  return CATEGORY_LABEL[value];
}
