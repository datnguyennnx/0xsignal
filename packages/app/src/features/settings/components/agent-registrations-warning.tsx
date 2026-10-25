import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuthStore } from "@/stores/use-auth-store";
import type { AgentRegistration } from "@/services/api";
import { useAgentRegistrations } from "../hooks/use-agent-registrations";

const HYPERLIQUID_API_URL = "https://app.hyperliquid.xyz/API";

const formatExpiry = (expiresAt: string | undefined): string => {
  if (expiresAt === undefined) return "No recorded expiry";
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) return expiresAt;
  return parsed.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

interface AgentRegistrationsBannerProps {
  readonly registrations: ReadonlyArray<AgentRegistration>;
}

export function AgentRegistrationsBanner({ registrations }: AgentRegistrationsBannerProps) {
  if (registrations.length === 0) return null;

  return (
    <Alert>
      <AlertTriangle />
      <AlertTitle>Earlier agent approvals may still be active</AlertTitle>
      <AlertDescription>
        <p>
          This app used to store your Hyperliquid agent key. It no longer does, and Hyperliquid has
          no revoke action: an approval stays valid on Hyperliquid&apos;s side until it is replaced
          or expires, even if you stop using this app.
        </p>
        <ul className="w-full space-y-1">
          {registrations.map((registration) => (
            <li
              key={`${registration.agentAddress}-${registration.createdAt}`}
              className="flex flex-wrap items-baseline gap-x-2 font-mono text-xs"
            >
              <span>{registration.agentAddress}</span>
              <span className="text-muted-foreground">
                expires {formatExpiry(registration.expiresAt)}
              </span>
              <span className={registration.status === "active" ? "text-amber-500" : undefined}>
                {registration.status === "active" ? "active" : "expired"}
              </span>
            </li>
          ))}
        </ul>
        <p>
          To replace an approval, approve a new agent with the same name from Hyperliquid&apos;s own
          UI. Otherwise it expires on the date shown. See the{" "}
          <a
            href={HYPERLIQUID_API_URL}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            Hyperliquid API page
          </a>
          .
        </p>
      </AlertDescription>
    </Alert>
  );
}

export function AgentRegistrationsWarning() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { data } = useAgentRegistrations(isAuthenticated);

  return <AgentRegistrationsBanner registrations={data ?? []} />;
}
