export type TableState = "loading" | "empty" | "error";

interface TableStateInput {
  isLoading: boolean;
  isError: boolean;
}

/**
 * A pending read is never an empty result, and a failed read is never an empty
 * result either. Loading wins when both flags are set (a refetch that is also
 * carrying a previous error), then error, then the genuine empty state.
 */
export function resolveTableState({ isLoading, isError }: TableStateInput): TableState {
  if (isLoading) return "loading";
  if (isError) return "error";
  return "empty";
}
