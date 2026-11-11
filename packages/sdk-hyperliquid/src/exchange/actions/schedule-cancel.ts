/**
 * @hyperliquid-api POST /exchange action "scheduleCancel"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { map, type MpMap, type MpValue } from "../../core/msgpack";

export type ScheduleCancelAction = { time?: number };

export const SCHEDULE_CANCEL_TYPE = "scheduleCancel" as const;

export function encodeScheduleCancel(action: ScheduleCancelAction): MpMap {
  const m: [string, MpValue][] = [["type", SCHEDULE_CANCEL_TYPE]];
  if (action.time !== undefined) m.push(["time", action.time]);
  return map(m);
}
