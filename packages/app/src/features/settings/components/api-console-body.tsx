import type { ReactNode } from "react";
import { Terminal, Plug, Lock, ShieldCheck, type LucideIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { truncateAddress } from "@/core/utils/formatters";
import { SettingsSection } from "./settings-section";

export type ConsoleView = "connect" | "loading" | "signin" | "link" | "form";

interface ApiConsoleBodyProps {
  readonly view: ConsoleView;
  readonly isConnected: boolean;
  readonly address: string | undefined;
  readonly needsReverification: boolean;
  readonly onConnect: () => void;
  readonly onSignIn: () => void;
  readonly onLinkWallet: () => void;
}

function ConsoleHeader() {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="flex items-center gap-inline type-title font-semibold text-foreground">
        <Terminal className="size-icon" />
        Trading Wallet
      </h3>
      <p className="type-body text-muted-foreground">
        Orders are signed by your own wallet. This app never asks for a private key or API key.
      </p>
    </div>
  );
}

interface ConsoleNoticeProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: "outline" | "accent";
}

function ConsoleNotice({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionVariant = "outline",
}: ConsoleNoticeProps) {
  return (
    <div className="flex flex-col items-center gap-stack py-6 text-center">
      <Icon className="size-icon-lg text-muted-foreground" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="type-title font-semibold text-foreground">{title}</p>
        <p className="type-body text-muted-foreground">{description}</p>
      </div>
      {actionLabel === undefined || onAction === undefined ? null : (
        <Button type="button" variant={actionVariant} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

interface ConsoleFormProps {
  isConnected: boolean;
  address: string | undefined;
  needsReverification: boolean;
  onLinkWallet: () => void;
}

function ConsoleForm({
  isConnected,
  address,
  needsReverification,
  onLinkWallet,
}: ConsoleFormProps) {
  const walletValue =
    isConnected && address !== undefined ? truncateAddress(address) : "Not connected";

  return (
    <div className="flex flex-col gap-stack">
      {needsReverification ? (
        <Alert variant="destructive">
          <ShieldCheck />
          <AlertTitle>This wallet is not verified</AlertTitle>
          <AlertDescription>
            <p>
              Sign the verification message again to prove you control this wallet and restore
              access to your account data.
            </p>
            <Button type="button" variant="outline" onClick={onLinkWallet}>
              Re-verify wallet
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-2">
        <p className="type-label font-medium text-muted-foreground">Active wallet</p>
        <Input
          readOnly
          aria-label="Active wallet address"
          value={walletValue}
          className="max-w-(--measure-form) text-muted-foreground"
        />
      </div>
      <Alert>
        <ShieldCheck />
        <AlertDescription>
          <p>
            You will approve each Hyperliquid order in your wallet. The app shows the decoded order
            and a connectionId before the signature prompt opens.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}

type ConsoleViewProps = Omit<ApiConsoleBodyProps, "view">;

const VIEW_RENDERERS: Record<ConsoleView, (props: ConsoleViewProps) => ReactNode> = {
  connect: ({ onConnect }) => (
    <ConsoleNotice
      icon={Plug}
      title="Connect your wallet"
      description="Connect your wallet to start trading."
      actionLabel="Connect Wallet"
      actionVariant="accent"
      onAction={onConnect}
    />
  ),
  loading: () => null,
  signin: ({ onSignIn }) => (
    <ConsoleNotice
      icon={Lock}
      title="Sign in to trade"
      description="Sign in to link your wallet and sign orders."
      actionLabel="Sign In"
      onAction={onSignIn}
    />
  ),
  link: ({ onLinkWallet }) => (
    <ConsoleNotice
      icon={Lock}
      title="Link a wallet to continue"
      description="Link a wallet to your account to sign orders."
      actionLabel="Link Wallet"
      onAction={onLinkWallet}
    />
  ),
  form: ({ isConnected, address, needsReverification, onLinkWallet }) => (
    <ConsoleForm
      isConnected={isConnected}
      address={address}
      needsReverification={needsReverification}
      onLinkWallet={onLinkWallet}
    />
  ),
};

export function ApiConsoleBody(props: ApiConsoleBodyProps) {
  return (
    <SettingsSection>
      <ConsoleHeader />
      {VIEW_RENDERERS[props.view](props)}
    </SettingsSection>
  );
}
