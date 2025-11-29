interface LoadingProps {
  message?: string;
  context?: string;
}
export declare function QueryLoading({
  message,
  context,
}: LoadingProps): import("react/jsx-runtime").JSX.Element;
interface ErrorProps {
  title: string;
  message?: string;
  onRetry?: () => void;
}
export declare function QueryError({
  title,
  message,
  onRetry,
}: ErrorProps): import("react/jsx-runtime").JSX.Element;
interface EmptyProps {
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}
export declare function QueryEmpty({
  title,
  message,
  action,
}: EmptyProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=query-state.d.ts.map
