import { lazy, Suspense, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ResetLayoutButton } from "@/components/reset-layout-button";
import { useWalletAvailable, useWalletConnection } from "@/components/wallet-provider";
import { useAppStore } from "@/stores/use-app-store";
import { selectAccountView } from "@/hooks/account-view";

// The dialog pulls the wallet-connect options + wagmi connector SDKs; it only
// mounts after a click, so keep that graph out of the entry chunk.
const loadConnectDialog = () => import("@/components/connect-wallet-dialog");

const ConnectWalletDialogLazy = lazy(() =>
  loadConnectDialog().then((m) => ({
    default: m.ConnectWalletDialog,
  })),
);

/** Kick off the chunk on intent so the dialog opens without a suspension flash. */
function warmConnectDialog(): void {
  void loadConnectDialog();
}

const shortAddress = (value: string): string => `${value.slice(0, 6)}…${value.slice(-4)}`;

interface AccountMenuItem {
  label: string;
  onSelect: () => void;
}

function AccountMenu({ label, items }: { label: string; items: AccountMenuItem[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" data-dense className="type-label" />}>
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10}>
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            onClick={item.onSelect}
            className="flex cursor-pointer items-center gap-inline px-2 py-1 type-label font-medium text-muted-foreground hover:bg-accent hover:text-foreground motion-control"
          >
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WalletNav({
  available,
  onConnect,
  onWarm,
}: {
  available: boolean;
  onConnect: () => void;
  onWarm: () => void;
}) {
  const { address, isConnected, disconnect } = useWalletConnection();
  const { address: routeAddress } = useParams<{ address: string }>();
  const navigate = useNavigate();
  const view = selectAccountView({ routeAddress, connectionAddress: address });

  if (view.whaleAddress !== undefined) {
    return (
      <AccountMenu
        label={shortAddress(view.whaleAddress)}
        items={[
          {
            label: "Exit read-only",
            onSelect: () => {
              void navigate("/portfolio");
            },
          },
        ]}
      />
    );
  }

  if (isConnected && address !== undefined) {
    return (
      <AccountMenu
        label={shortAddress(address)}
        items={[
          {
            label: "Disconnect",
            onSelect: () => {
              disconnect();
            },
          },
        ]}
      />
    );
  }

  if (!available) return null;

  return (
    <Button
      variant="accent"
      data-dense
      className="type-label font-medium"
      onPointerDown={onWarm}
      onClick={onConnect}
    >
      Connect Wallet
    </Button>
  );
}

export function UserNav() {
  const available = useWalletAvailable();
  const isConnectWalletOpen = useAppStore((s) => s.connectWalletOpen["user-nav"] ?? false);
  const openConnectWallet = useCallback(() => {
    useAppStore.getState().openConnectWallet("user-nav");
  }, []);
  const closeConnectWallet = useCallback(() => {
    useAppStore.getState().closeConnectWallet("user-nav");
  }, []);
  const navigate = useNavigate();

  return (
    <div className="row-actions">
      <WalletNav available={available} onConnect={openConnectWallet} onWarm={warmConnectDialog} />

      <ResetLayoutButton />

      <Button
        variant="outline"
        size="icon"
        data-dense
        onClick={() => {
          void navigate("/settings?tab=appearance");
        }}
      >
        <Settings className="size-icon" />
        <span className="sr-only">Settings</span>
      </Button>

      {available && isConnectWalletOpen && (
        <Suspense fallback={null}>
          <ConnectWalletDialogLazy
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                closeConnectWallet();
              }
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
