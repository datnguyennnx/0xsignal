import type { AsyncStatus } from "@/lib/async-state";

interface RowStatusInput {
  isLoading: boolean;
  isError: boolean;
  rowCount: number;
}

/**
 * A pending read is never an empty result, and a failed read is never an empty
 * result either. Loading wins when both flags are set (a refetch that is also
 * carrying a previous error), then error, then the settled row list.
 */
export function resolveRowStatus({ isLoading, isError, rowCount }: RowStatusInput): AsyncStatus {
  if (isLoading) return "loading";
  if (isError) return "error";
  return rowCount === 0 ? "empty" : "ready";
}
