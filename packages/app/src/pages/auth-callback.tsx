import { useEffect } from "react";
import { api } from "@/services/api";
import { setAuthToken } from "@/lib/api-base";

export function AuthCallbackPage() {
  useEffect(() => {
    let cancelled = false;

    async function performCallback() {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");

      if (code) {
        try {
          const data = await api.exchangeCode(code);
          if (cancelled) return;
          if (data && data.accessToken) {
            setAuthToken(data.accessToken);
          }
        } catch (error) {
          console.error("[Auth] Token exchange failed:", error);
        }
      }

      // Redirect to trading page — always, even on failure (will show login prompt)
      window.location.href = "/trade/BTC";
    }

    performCallback();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-6 w-6 border-2 border-foreground/20 rounded-full animate-spin" />
    </div>
  );
}
