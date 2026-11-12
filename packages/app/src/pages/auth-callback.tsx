import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/use-auth-store";
import { queryKeys } from "@/lib/query-keys";
import { ErrorState } from "@/components/error-state";
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
  const queryClient = useQueryClient();
  const controllerRef = useRef<AbortController | null>(null);

  const { mutate, error, reset } = useMutation({
    mutationFn: (code: string) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      return completeSignIn(code, controller.signal);
    },
    onSuccess: (completed) => {
      if (completed) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
        void navigate(TRADE_ROUTE, { replace: true });
      }
    },
  });

  const run = useCallback(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code === null || code === "") {
      void navigate(TRADE_ROUTE, { replace: true });
      return;
    }
    mutate(code);
  }, [navigate, mutate]);

  useEffect(() => {
    run();
    return () => {
      controllerRef.current?.abort();
    };
  }, [run]);

  if (error === null) return null;

  return (
    <ErrorState
      title="Authentication failed"
      description="Unable to complete sign-in. Try again."
      retryAction={() => {
        reset();
        run();
      }}
      className="min-h-dvh"
    />
  );
}
