import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/use-auth-store";
import { ErrorState } from "@/components/error-state";
import { PageLoader } from "@/components/page-loader";
import { isAborted } from "@/pages/auth-callback-utils";

const TRADE_ROUTE = "/trade/BTC";

/** One owner for the exchange → token → profile → wallet sequence, initial and retry. */
async function completeSignIn(code: string, signal?: AbortSignal): Promise<boolean> {
  const data = await api.exchangeCode(code);
  if (isAborted(signal)) return false;
  if (!data.accessToken) throw new Error("Sign-in response did not include an access token.");

  useAuthStore.getState().setToken(data.accessToken);

  try {
    const profile = await api.getAuthMe();
    if (isAborted(signal)) return false;
    useAuthStore.getState().setUser({
      userId: profile.userId,
      provider: profile.provider,
      avatarUrl: profile.avatarUrl,
      displayName: profile.displayName,
    });
    await useAuthStore.getState().refreshWalletStatus();
  } catch (err) {
    console.error("[Auth] Failed to fetch profile after login:", err);
  }

  return true;
}

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const signal = controller.signal;

    const code = new URLSearchParams(window.location.search).get("code");
    if (code === null || code === "") {
      if (!isAborted(signal)) void navigate(TRADE_ROUTE, { replace: true });
      return;
    }
    try {
      const completed = await completeSignIn(code, signal);
      if (completed && !isAborted(signal)) void navigate(TRADE_ROUTE, { replace: true });
    } catch (err) {
      console.error("[Auth] Token exchange failed:", err);
      if (!isAborted(signal)) setError("Unable to complete sign-in. Try again.");
    }
  }, [navigate]);

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- the async exchange must own its error state
    void run();
    return () => {
      controllerRef.current?.abort();
    };
  }, [run]);

  useEffect(() => {
    if (error === null) return;
    toast.error("Sign-in failed", { description: error });
  }, [error]);

  if (error !== null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-transparent">
        <ErrorState
          title="Authentication failed"
          description={error}
          retryAction={() => {
            setError(null);
            void run();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-transparent">
      <PageLoader variant="fullscreen" />
    </div>
  );
}
