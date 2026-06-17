import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { setAuthToken } from "@/lib/api-base";
import { ErrorState } from "@/components/error-state";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function performCallback() {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");

      if (!code) {
        navigate("/trade/BTC", { replace: true });
        return;
      }

      try {
        const data = await api.exchangeCode(code);
        if (cancelled) return;
        if (data && data.accessToken) {
          setAuthToken(data.accessToken);
          navigate("/trade/BTC", { replace: true });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[Auth] Token exchange failed:", err);
          setError(err instanceof Error ? err.message : "Token exchange failed");
        }
      }
    }

    performCallback();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <ErrorState
          title="Authentication failed"
          description={error}
          retryAction={() => {
            setError(null);
            const code = new URLSearchParams(window.location.search).get("code");
            if (code) {
              api
                .exchangeCode(code)
                .then((data) => {
                  if (data && data.accessToken) {
                    setAuthToken(data.accessToken);
                    navigate("/trade/BTC", { replace: true });
                  }
                })
                .catch((err) => {
                  setError(err instanceof Error ? err.message : "Token exchange failed");
                });
            } else {
              navigate("/trade/BTC", { replace: true });
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-6 w-6 border-2 border-foreground/20 rounded-full animate-spin" />
    </div>
  );
}
