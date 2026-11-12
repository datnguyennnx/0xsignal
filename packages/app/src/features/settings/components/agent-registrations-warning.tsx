import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useOwnAddress } from "@/hooks/use-effective-address";
import { useAuthStore } from "@/stores/use-auth-store";
import type { AgentRegistration } from "@/services/api";
import { formatDateLabel } from "@/features/calendar/lib/date-utils";
import { useAgentRegistrations } from "../hooks/use-agent-registrations";

const HYPERLIQUID_API_URL = "https://app.hyperliquid.xyz/API";

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
              className="flex flex-wrap items-baseline gap-x-2 font-mono type-label"
            >
              <span>{registration.agentAddress}</span>
              <span className="text-muted-foreground">
                expires{" "}
                {registration.expiresAt === undefined
                  ? "No recorded expiry"
                  : formatDateLabel(registration.expiresAt)}
              </span>
              <span className={registration.status === "active" ? "text-warn" : undefined}>
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

function AgentRegistrationsLoadingRow() {
  return (
    <output
      aria-live="polite"
      aria-busy="true"
      className="state-delay flex items-center gap-2 rounded-control bg-muted/40 px-3 py-2"
    >
      <span className="type-label text-muted-foreground">Checking earlier agent approvals</span>
    </output>
  );
}

function AgentRegistrationsErrorRow({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert>
      <AlertTriangle />
      <AlertTitle>Couldn&apos;t check earlier agent approvals</AlertTitle>
      <AlertDescription>
        The approval history request failed. Check your connection and try again.
        <Button variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}

interface AgentRegistrationsWarningProps {
  /** Only the wallet tab that shows approvals needs this probe. */
  readonly enabled?: boolean;
}

export function AgentRegistrationsWarning({ enabled = true }: AgentRegistrationsWarningProps = {}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const address = useOwnAddress() ?? "";
  const { state, refetch } = useAgentRegistrations(address, isAuthenticated && enabled);

  // Disabled or signed out means the query never ran, so render nothing.
  if (!enabled || !isAuthenticated) return null;
  if (state.status === "loading") return <AgentRegistrationsLoadingRow />;
  if (state.status === "error") {
    return (
      <AgentRegistrationsErrorRow
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  return <AgentRegistrationsBanner registrations={state.status === "ready" ? state.data : []} />;
}
