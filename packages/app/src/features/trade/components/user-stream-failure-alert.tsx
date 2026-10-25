import { useSyncExternalStore } from "react";
import { getUserStreamFailure, onUserStreamFailureChange } from "../lib/user-stream-default";
import type { UserStreamFailure } from "../lib/user-stream-types";

const subscribeFailure = (onChange: () => void): (() => void) =>
  onUserStreamFailureChange(() => {
    onChange();
  });

const getServerFailure = (): UserStreamFailure | null => null;

const FAILURE_TEXT: Record<NonNullable<UserStreamFailure>["kind"], string> = {
  "subscribe-rejected": "rejected the connection",
  "socket-closed": "lost its connection",
  "auth-required": "is unavailable without a wallet",
};

/** Surfaces a typed stream failure instead of leaving stale data unexplained. */
export function UserStreamFailureAlert() {
  const failure = useSyncExternalStore(subscribeFailure, getUserStreamFailure, getServerFailure);
  if (failure === null) return null;

  return (
    <p
      role="alert"
      data-failure-kind={failure.kind}
      className="text-xs text-amber-600 dark:text-amber-500"
    >
      Account data stream {FAILURE_TEXT[failure.kind]}. Showing the last known values.
    </p>
  );
}
