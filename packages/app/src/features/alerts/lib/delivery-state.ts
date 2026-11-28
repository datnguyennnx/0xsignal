import type { AlertChannel, ChannelRow } from "@/services/api/alerts";

export interface PendingLink {
  channel: AlertChannel;
  code: string;
  expiresAt: string;
  deepLink: string | null;
}

export type DeliveryState =
  | { kind: "unavailable" }
  | { kind: "disconnected" }
  | { kind: "pending"; link: PendingLink }
  | { kind: "connected"; row: ChannelRow };

export function resolveDeliveryState(
  channel: AlertChannel,
  available: boolean,
  row: ChannelRow | undefined,
  pending: PendingLink | null,
): DeliveryState {
  if (!available) return { kind: "unavailable" };
  if (row !== undefined && row.verifiedAt !== null) return { kind: "connected", row };
  if (pending !== null && pending.channel === channel) return { kind: "pending", link: pending };
  return { kind: "disconnected" };
}
