import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { DataRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { ErrorBoundary } from "@/components/error-boundary";
import { AppToasters } from "@/components/app-toasters";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/stores/use-app-store";
import { useAuthStore } from "@/stores/use-auth-store";

export function App({ router }: { router: DataRouter }) {
  const checkSchemaVersion = useAppStore((s) => s.checkSchemaVersion);
  useEffect(() => {
    checkSchemaVersion();
  }, [checkSchemaVersion]);
  useEffect(() => {
    const cancel = useAuthStore.getState().initialize();
    return cancel;
  }, []);
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
      <AppToasters />
    </ErrorBoundary>
  );
}
