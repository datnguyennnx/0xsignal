import { createUserStreamClient } from "./user-stream-client";

export { mergeUserFills } from "./user-stream-types";
export type {
  UserStreamChannel,
  UserStreamConnectionState,
  UserStreamEventMap,
  UserStreamSubscription,
} from "./user-stream-types";

import type {
  ClearinghouseStreamEvent,
  OpenOrdersStreamEvent,
  SpotStateStreamEvent,
  UserFillsStreamEvent,
  UserStreamClient,
  UserStreamConnectionState,
  UserStreamFailure,
  UserStreamFailureKind,
  UserStreamSubscription,
} from "./user-stream-types";

let defaultClient: UserStreamClient | null = null;

function getDefaultClient(): UserStreamClient {
  defaultClient ??= createUserStreamClient();
  return defaultClient;
}

export function subscribeClearinghouseState(
  user: string,
  listener: (event: ClearinghouseStreamEvent) => void,
): Promise<UserStreamSubscription> {
  return getDefaultClient().subscribeClearinghouseState(user, listener);
}

export function subscribeSpotState(
  user: string,
  listener: (event: SpotStateStreamEvent) => void,
): Promise<UserStreamSubscription> {
  return getDefaultClient().subscribeSpotState(user, listener);
}

export function subscribeUserFills(
  user: string,
  listener: (event: UserFillsStreamEvent) => void,
): Promise<UserStreamSubscription> {
  return getDefaultClient().subscribeUserFills(user, listener);
}

export function subscribeOpenOrders(
  user: string,
  listener: (event: OpenOrdersStreamEvent) => void,
): Promise<UserStreamSubscription> {
  return getDefaultClient().subscribeOpenOrders(user, listener);
}

export function getUserStreamConnectionState(): UserStreamConnectionState {
  return getDefaultClient().getConnectionState();
}

export function onUserStreamConnectionStateChange(
  listener: (state: UserStreamConnectionState) => void,
): () => void {
  return getDefaultClient().onConnectionStateChange(listener);
}

export function getUserStreamFailure(): UserStreamFailure | null {
  return getDefaultClient().getLastFailure();
}

export function onUserStreamFailureChange(
  listener: (failure: UserStreamFailure | null) => void,
): () => void {
  return getDefaultClient().onFailureChange(listener);
}

export function reportUserStreamFailure(kind: UserStreamFailureKind, message: string): void {
  getDefaultClient().reportFailure(kind, message);
}
