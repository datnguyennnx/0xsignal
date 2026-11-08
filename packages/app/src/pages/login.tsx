import { useSearchParams } from "react-router-dom";
import { Github, Google } from "@thesvg/react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-transparent px-4 page-enter">
      <div className="flex w-full max-w-sm flex-col items-center gap-section">
        <span className="type-heading font-bold tracking-tight text-foreground">0xsignal</span>

        <div className="flex flex-col items-center gap-stack">
          <h1 className="type-heading font-bold tracking-tight text-foreground">Welcome back</h1>
          <p className="max-w-xs text-center type-body leading-relaxed text-muted-foreground italic">
            &quot;Every model is a myth until the market proves it real. Trade the abstraction, not
            the noise.&quot;
          </p>
        </div>

        {error === null ? null : (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex w-full flex-col gap-inline">
          <Button
            variant="outline"
            size="cta"
            className="w-full gap-inline"
            onClick={() => {
              window.location.href = "/api/auth/google/login";
            }}
          >
            <Google className="size-icon shrink-0" />
            Continue with Google
          </Button>
          <Button
            variant="outline"
            size="cta"
            className="w-full gap-inline"
            onClick={() => {
              window.location.href = "/api/auth/github/login";
            }}
          >
            <Github className="size-icon shrink-0" />
            Continue with GitHub
          </Button>
        </div>
      </div>
    </div>
  );
}
