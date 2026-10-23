import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/use-auth-store";
import { ErrorState } from "@/components/error-state";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function performCallback() {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");

      if (code === null || code === "") {
        void navigate("/trade/BTC", { replace: true });
        return;
      }

      try {
        const data = await api.exchangeCode(code);
        if (cancelled) return;
        if (data.accessToken) {
          useAuthStore.getState().setToken(data.accessToken);

          try {
            const profile = await api.getAuthMe();
            if (!cancelled) {
              useAuthStore.getState().setUser({
                userId: profile.userId,
                provider: profile.provider,
                avatarUrl: profile.avatarUrl,
                displayName: profile.displayName,
              });
            }
            if (!cancelled) {
              await useAuthStore.getState().refreshWalletStatus();
            }
          } catch (err) {
            if (!cancelled) {
              console.error("[Auth] Failed to fetch profile after login:", err);
            }
          }

          if (!cancelled) {
            void navigate("/trade/BTC", { replace: true });
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[Auth] Token exchange failed:", err);
          setError("Unable to complete sign-in. Try again.");
        }
      }
    }

    void performCallback();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

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
            const code = new URLSearchParams(window.location.search).get("code");
            if (code !== null && code !== "") {
              void (async () => {
                try {
                  const data = await api.exchangeCode(code);
                  if (data.accessToken) {
                    useAuthStore.getState().setToken(data.accessToken);

                    try {
                      const profile = await api.getAuthMe();
                      useAuthStore.getState().setUser({
                        userId: profile.userId,
                        provider: profile.provider,
                        avatarUrl: profile.avatarUrl,
                        displayName: profile.displayName,
                      });
                      await useAuthStore.getState().refreshWalletStatus();
                    } catch (profileErr) {
                      console.error("[Auth] Failed to fetch profile after login:", profileErr);
                    }

                    void navigate("/trade/BTC", { replace: true });
                  }
                } catch (err) {
                  console.error("[Auth] Token exchange failed:", err);
                  setError("Unable to complete sign-in. Try again.");
                }
              })();
            } else {
              void navigate("/trade/BTC", { replace: true });
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-transparent">
      <div className="h-6 w-6 border-2 border-foreground/20 rounded-full animate-spin" />
    </div>
  );
}
