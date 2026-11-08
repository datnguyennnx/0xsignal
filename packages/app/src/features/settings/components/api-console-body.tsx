import type { ReactNode } from "react";
import { Terminal, Plug, Lock, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { truncateAddress } from "@/core/utils/formatters";
import { SettingsSection } from "./settings-section";

export type ConsoleView = "connect" | "loading" | "signin" | "link" | "form";

interface ApiConsoleBodyProps {
  readonly view: ConsoleView;
  readonly isConnected: boolean;
  readonly address: `0x${string}` | undefined;
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
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: "outline" | "accent";
}

function ConsoleNotice({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionVariant = "outline",
}: ConsoleNoticeProps) {
  return (
    <div className="flex flex-col items-center gap-stack py-6 text-center">
      <span className="text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
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

function ConsoleLoading() {
  return (
    <div className="flex flex-col gap-inline py-6">
      <Skeleton className="h-(--control-h) w-full max-w-(--measure-form)" />
      <Skeleton className="h-(--control-h) w-2/3 max-w-(--measure-form)" />
    </div>
  );
}

interface ConsoleFormProps {
  isConnected: boolean;
  address: `0x${string}` | undefined;
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

export function ApiConsoleBody({
  view,
  isConnected,
  address,
  needsReverification,
  onConnect,
  onSignIn,
  onLinkWallet,
}: ApiConsoleBodyProps) {
  return (
    <SettingsSection measure="form">
      <ConsoleHeader />
      {view === "connect" ? (
        <ConsoleNotice
          icon={<Plug className="size-icon-lg" />}
          title="Connect your wallet"
          description="Connect your wallet to start trading."
          actionLabel="Connect Wallet"
          actionVariant="accent"
          onAction={onConnect}
        />
      ) : null}
      {view === "loading" ? <ConsoleLoading /> : null}
      {view === "signin" ? (
        <ConsoleNotice
          icon={<Lock className="size-icon-lg" />}
          title="Sign in to trade"
          description="Sign in to link your wallet and sign orders."
          actionLabel="Sign In"
          onAction={onSignIn}
        />
      ) : null}
      {view === "link" ? (
        <ConsoleNotice
          icon={<Lock className="size-icon-lg" />}
          title="Link a wallet to continue"
          description="Link a wallet to your account to sign orders."
          actionLabel="Link Wallet"
          onAction={onLinkWallet}
        />
      ) : null}
      {view === "form" ? (
        <ConsoleForm
          isConnected={isConnected}
          address={address}
          needsReverification={needsReverification}
          onLinkWallet={onLinkWallet}
        />
      ) : null}
    </SettingsSection>
  );
}
