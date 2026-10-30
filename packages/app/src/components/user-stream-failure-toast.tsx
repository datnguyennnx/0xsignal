import { useEffect } from "react";
import { toast } from "sonner";
import {
  getUserStreamFailure,
  onUserStreamFailureChange,
} from "@/features/trade/lib/user-stream-default";
import type {
  UserStreamFailure,
  UserStreamFailureKind,
} from "@/features/trade/lib/user-stream-types";

const TOAST_ID = "user-stream-failure";

const FAILURE_TEXT: Record<UserStreamFailureKind, string> = {
  "subscribe-rejected": "Account data stream rejected the connection",
  "socket-closed": "Account data stream lost its connection",
  "auth-required": "Account data stream is unavailable without a wallet",
};

const showFailure = (failure: UserStreamFailure | null): void => {
  if (failure === null) {
    toast.dismiss(TOAST_ID);
    return;
  }

  toast.warning(FAILURE_TEXT[failure.kind], {
    id: TOAST_ID,
    description: "Showing the last known values.",
  });
};

/** Stream failures are toasts, never inline status lines: one id replaces, recovery dismisses. */
export function UserStreamFailureToast(): null {
  useEffect(() => {
    showFailure(getUserStreamFailure());
    return onUserStreamFailureChange(showFailure);
  }, []);

  return null;
}
