import { Suspense, type ReactNode } from "react";

interface SuspenseBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

const DefaultFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="text-center space-y-3">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto"></div>
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

export const SuspenseBoundary = ({ children, fallback }: SuspenseBoundaryProps) => {
  return <Suspense fallback={fallback || <DefaultFallback />}>{children}</Suspense>;
};
