import { lazy, Suspense, useSyncExternalStore } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useAppStore } from "@/stores/use-app-store";
import {
  getStreamFailureSnapshot,
  subscribeStreamFailure,
} from "@/features/trade/lib/user-stream-failure-bridge";

// The toast component is the only entry consumer of the account-stream module graph
// (the HL WS SDK included). It paints nothing until a failure exists, so mounting
// the boundary lazily keeps that graph off the shell's entry chunk. The failure
// state is mirrored through an entry-safe bridge, so a failure that happened
// before the chunk landed still mounts (and shows) the toast.
const UserStreamFailureToastLazy = lazy(() =>
  import("@/components/user-stream-failure-toast").then((m) => ({
    default: m.UserStreamFailureToast,
  })),
);

const NO_FAILURE_ON_SERVER = (): null => null;

/** The single global toast host, mounted for every route. */
export function AppToasters() {
  const failure = useSyncExternalStore(
    subscribeStreamFailure,
    getStreamFailureSnapshot,
    NO_FAILURE_ON_SERVER,
  );
  const theme = useAppStore((state) =>
    state.theme === "system" ? state.systemTheme : state.theme,
  );

  return (
    <>
      <Toaster theme={theme} />
      {failure !== null && (
        <Suspense fallback={null}>
          <UserStreamFailureToastLazy />
        </Suspense>
      )}
    </>
  );
}
