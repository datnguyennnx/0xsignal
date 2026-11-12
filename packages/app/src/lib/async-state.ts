export type AsyncStatus = "idle" | "loading" | "ready" | "empty" | "error";

export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading"; stale?: T }
  | { status: "ready"; data: T; stale: boolean }
  | { status: "empty"; reason: "first-use" | "no-results"; stale?: boolean }
  | { status: "error"; error: Error };

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);
  return new Error("Unknown error");
}

export function toAsyncState<T>(input: {
  enabled?: boolean;
  isPending: boolean;
  isFetching?: boolean;
  isPlaceholderData?: boolean;
  isError: boolean;
  error?: unknown;
  data: T | undefined;
  isEmpty?: (data: T) => boolean;
  emptyReason?: "first-use" | "no-results";
}): AsyncState<T> {
  const {
    enabled = true,
    isPending,
    isFetching = false,
    isPlaceholderData = false,
    isError,
    error,
    data,
    isEmpty,
    emptyReason = "no-results",
  } = input;

  if (data !== undefined) {
    // A failed background refetch must not replace data already on screen.
    const stale = isFetching || isPlaceholderData || isError;
    if (isEmpty !== undefined && isEmpty(data)) {
      return { status: "empty", reason: emptyReason, stale };
    }
    return { status: "ready", data, stale };
  }

  // A disabled query reports isPending, but it is waiting on intent, not data.
  if (!enabled) return { status: "idle" };
  if (isPending) return { status: "loading" };
  if (isError) return { status: "error", error: toError(error) };
  // Settled, successful, and still undefined: the server answered with no
  // value, so the region is genuinely empty before its first record.
  return { status: "empty", reason: "first-use" };
}
