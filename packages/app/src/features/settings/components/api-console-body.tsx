import { Terminal, Plug, Lock, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { truncateAddress } from "@/core/utils/formatters";

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
    <div className="flex flex-col gap-[clamp(1rem,1.5vw,1.5rem)]">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
          <Terminal className="size-4 text-primary" />
          Trading Wallet
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Orders are signed by your own wallet. This app never asks for a private key or API key.
        </p>
      </div>

      {view === "connect" && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Plug className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">Connect your wallet</p>
            <p className="text-sm text-muted-foreground">Connect your wallet to start trading.</p>
          </div>
          <Button type="button" variant="outline" onClick={onConnect}>
            Connect Wallet
          </Button>
        </div>
      )}

      {view === "loading" && (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {view === "signin" && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Lock className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">Sign in to trade</p>
            <p className="text-sm text-muted-foreground">
              Sign in to link your wallet and sign orders.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onSignIn}>
            Sign In
          </Button>
        </div>
      )}

      {view === "link" && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Lock className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">Link a wallet to continue</p>
            <p className="text-sm text-muted-foreground">
              Link a wallet to your account to sign orders.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onLinkWallet}>
            <Plug className="mr-2 size-4" />
            Link Wallet
          </Button>
        </div>
      )}

      {view === "form" && (
        <div className="flex flex-col gap-[clamp(1rem,1.5vw,1.5rem)]">
          {needsReverification && (
            <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <ShieldCheck className="size-4 shrink-0 text-destructive" />
                This wallet is not verified
              </p>
              <p className="text-muted-foreground">
                Sign the verification message again to prove you control this wallet and restore
                access to your account data.
              </p>
              <Button type="button" variant="outline" onClick={onLinkWallet}>
                Re-verify wallet
              </Button>
            </div>
          )}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Active wallet</p>
            <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {isConnected && address !== undefined ? truncateAddress(address) : "Not connected"}
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-md border border-input p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              You will approve each Hyperliquid order in your wallet. The app shows the decoded
              order and a connectionId before the signature prompt opens.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
