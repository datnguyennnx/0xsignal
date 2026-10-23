import { Predicate } from "effect";

export const asRecord = (value: unknown): Record<string, unknown> | null =>
  Predicate.isObject(value) ? value : null;

export const isUnknownArray = (value: unknown): value is unknown[] => Array.isArray(value);

export const stringAt = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
};

export const numberAt = (record: Record<string, unknown>, key: string): number | undefined => {
  const value = record[key];
  return typeof value === "number" ? value : undefined;
};
