import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "@/app-router";
import { ErrorBoundary } from "@/components/error-boundary";
import { AppToasters } from "@/components/app-toasters";
import { usePreloadRoutes } from "@/lib/preload-routes";
import { useAppStore } from "@/stores/use-app-store";
import { useAuthStore } from "@/stores/use-auth-store";

export function App() {
  const checkSchemaVersion = useAppStore((s) => s.checkSchemaVersion);
  useEffect(() => {
    checkSchemaVersion();
  }, [checkSchemaVersion]);
  useEffect(() => {
    const cancel = useAuthStore.getState().initialize();
    return cancel;
  }, []);
  usePreloadRoutes();
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRouter />
        <AppToasters />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
