const EVENT_TYPES = new Set([
  "order_placed",
  "order_filled",
  "order_cancelled",
  "position_opened",
  "position_closed",
  "signal",
  "error",
  "info",
] as const);

type EventType =
  | "order_placed"
  | "order_filled"
  | "order_cancelled"
  | "position_opened"
  | "position_closed"
  | "signal"
  | "error"
  | "info";

export const normalizeEventType = (value: string): EventType => {
  if (EVENT_TYPES.has(value as EventType)) {
    return value as EventType;
  }
  return "info";
};
