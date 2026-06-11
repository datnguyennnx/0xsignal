/**
 * Login Page — social authentication entry point.
 *
 * Clean, minimal design. Just logo, heading, and social login buttons.
 */
import { memo, useEffect } from "react";
import { Github, Google } from "@thesvg/react";
import { Button } from "@/components/ui/button";

export const LoginPage = memo(function LoginPage() {
  useEffect(() => {
    document.title = "Welcome back | 0xsignal";
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center pb-[clamp(4rem,8vw,6rem)] bg-background px-4 animate-in fade-in duration-200 ease-premium">
      <div className="flex w-full max-w-sm flex-col items-center gap-[clamp(1.5rem,3vw,2.5rem)]">
        {/* Brand mark */}
        <span className="text-[clamp(1.25rem,2.5vw,2rem)] font-bold tracking-tight text-foreground">
          0xsignal
        </span>

        {/* Heading & abstraction */}
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground/50 italic text-center leading-relaxed max-w-[18rem]">
            "Every model is a myth until the market proves it real. Trade the abstraction, not the
            noise."
          </p>
        </div>

        {/* Social login buttons */}
        <div className="flex w-full flex-col gap-3">
          <Button
            variant="outline"
            size="lg"
            className="w-full gap-3"
            onClick={() => {
              window.location.href = "/api/auth/google/login";
            }}
          >
            <Google className="size-5 shrink-0" />
            Continue with Google
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full gap-3"
            onClick={() => {
              window.location.href = "/api/auth/github/login";
            }}
          >
            <Github className="size-5 shrink-0" />
            Continue with GitHub
          </Button>
        </div>
      </div>
    </div>
  );
});
