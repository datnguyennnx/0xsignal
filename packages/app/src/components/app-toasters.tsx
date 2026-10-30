import { Toaster } from "@/components/ui/sonner";
import { UserStreamFailureToast } from "@/components/user-stream-failure-toast";

/** The single global toast host, mounted for every route. */
export function AppToasters() {
  return (
    <>
      <Toaster />
      <UserStreamFailureToast />
    </>
  );
}
