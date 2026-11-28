import type { Rule } from "@0xsignal/shared/alerts/index.ts";

import type { SegmentedOption } from "@/components/ui/segmented";
import { formatPrice } from "@/core/utils/formatters";

export type Operator = "above" | "below";
export type RepeatMode = "once" | "repeat";
export type Expiry = "1d" | "7d" | "30d" | "never";
export type ForSeconds = "0" | "60" | "300";
export type ImpactMinimum = "medium" | "high";
export type EventImpact = "low" | "medium" | "high";
export type LeadMinutes = "5" | "15" | "30";
export type SheetKind = "price" | "calendar";

export interface AlertSheetEvent {
  currency: string;
  scheduledAt: number;
  impact: EventImpact;
  title?: string | undefined;
  country?: string | undefined;
}

export interface SheetFormValues {
  kind: SheetKind;
  sentence: string;
  symbol: string;
  operator: Operator;
  value: string;
  currency: string;
  leadMinutes: LeadMinutes;
  impactMin: ImpactMinimum;
  repeat: RepeatMode;
  expiry: Expiry;
  forSeconds: ForSeconds;
  parseHint: string | null;
}

export const REPEAT_OPTIONS: readonly SegmentedOption<RepeatMode>[] = [
  { value: "once", label: "Once" },
  { value: "repeat", label: "Repeat" },
];

export const EXPIRY_OPTIONS: readonly SegmentedOption<Expiry>[] = [
  { value: "1d", label: "1d" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "never", label: "Never" },
];

export const QUICK_DIRECTION_OPTIONS: readonly SegmentedOption<Operator>[] = [
  { value: "above", label: "Above" },
  { value: "below", label: "Below" },
];

export const QUICK_STEP_PERCENTS = [1, 5, -1, -5] as const;

const DAY_MS = 86_400_000;

function expiresAt(expiry: Expiry): string | null {
  if (expiry === "never") return null;
  const days = expiry === "1d" ? 1 : expiry === "7d" ? 7 : 30;
  return new Date(Date.now() + days * DAY_MS).toISOString();
}

interface RuleFields {
  symbol: string;
  operator: Operator;
  value: number;
  forSeconds: ForSeconds;
  repeat: RepeatMode;
  expiry: Expiry;
}

export function buildRule({
  symbol,
  operator,
  value,
  forSeconds,
  repeat,
  expiry,
}: RuleFields): Rule {
  const summary = `${symbol} ${operator} ${formatPrice(value)}`;
  return {
    v: 1,
    kind: "price",
    name: summary,
    for_seconds: Number(forSeconds),
    cooldown_seconds: repeat === "once" ? 0 : 600,
    once: repeat === "once",
    targets: ["inapp"],
    severity: "info",
    summary,
    enabled: true,
    expires_at: expiresAt(expiry),
    condition: {
      subject: `price:${symbol}`,
      op: operator === "above" ? "gte" : "lte",
      value,
    },
  };
}

/** Twelve significant figures absorb float drift without inventing precision. */
export function shiftPriceByPercent(price: number, percent: number): number {
  return Number((price * (1 + percent / 100)).toPrecision(12));
}

interface QuickRuleFields {
  symbol: string;
  operator: Operator;
  value: number;
  repeatEvery10Min: boolean;
}

export function buildQuickRule({
  symbol,
  operator,
  value,
  repeatEvery10Min,
}: QuickRuleFields): Rule {
  return buildRule({
    symbol,
    operator,
    value,
    forSeconds: "0",
    repeat: repeatEvery10Min ? "repeat" : "once",
    expiry: "never",
  });
}

/** The worker matches events by currency code, so a typed region is mapped first. */
const REGION_CURRENCY: Record<string, string> = {
  US: "USD",
  USA: "USD",
  EU: "EUR",
  GB: "GBP",
  UK: "GBP",
  JP: "JPY",
  CA: "CAD",
  AU: "AUD",
  CH: "CHF",
  CN: "CNY",
  NZ: "NZD",
};

function normalizeCurrency(region: string): string {
  return REGION_CURRENCY[region] ?? region;
}

interface CalendarRuleFields {
  currency: string;
  impactMin: ImpactMinimum;
  leadMinutes: number;
  repeat: RepeatMode;
  expiry: Expiry;
  eventTitle?: string | undefined;
  eventCountry?: string | undefined;
}

export function buildCalendarRule({
  currency,
  impactMin,
  leadMinutes,
  repeat,
  expiry,
  eventTitle,
  eventCountry,
}: CalendarRuleFields): Rule {
  const region = currency.trim().toUpperCase();
  const impactLabel = impactMin === "high" ? "High-impact" : "Medium-impact";
  const countryLabel =
    eventCountry === undefined || eventCountry === "" ? "" : ` (${eventCountry})`;
  const summary =
    eventTitle === undefined || eventTitle === ""
      ? `${impactLabel} ${region} event`
      : `${eventTitle}${countryLabel} in ${leadMinutes} min`;

  return {
    v: 1,
    kind: "calendar",
    name: summary,
    for_seconds: 0,
    cooldown_seconds: repeat === "once" ? 0 : 600,
    once: repeat === "once",
    targets: ["inapp"],
    severity: "info",
    summary,
    enabled: true,
    expires_at: expiresAt(expiry),
    condition: {
      subject: `calendar:${normalizeCurrency(region)}`,
      impactMin,
      leadMinutes,
    },
  };
}

export function buildSheetRule(
  isQuick: boolean,
  values: SheetFormValues,
  initialEvent: AlertSheetEvent | undefined,
): Rule {
  const symbol = values.symbol.trim().toUpperCase();
  const currency = values.currency.trim().toUpperCase();
  const value = Number(values.value);

  if (isQuick) {
    return buildQuickRule({
      symbol,
      operator: values.operator,
      value,
      repeatEvery10Min: values.repeat === "repeat",
    });
  }

  if (values.kind === "price") {
    return buildRule({
      symbol,
      operator: values.operator,
      value,
      forSeconds: values.forSeconds,
      repeat: values.repeat,
      expiry: values.expiry,
    });
  }

  return buildCalendarRule({
    currency,
    impactMin: values.impactMin,
    leadMinutes: Number(values.leadMinutes),
    repeat: values.repeat,
    expiry: values.expiry,
    eventTitle: initialEvent?.title,
    eventCountry: initialEvent?.country,
  });
}
