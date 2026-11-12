import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { hasWalletSession } from "@/lib/wallet-session";

/** Wallet state exposed without importing wagmi outside the lazy boundary. */
export interface WalletConnection {
  address: string | undefined;
  isConnected: boolean;
  disconnect: () => void;
}

const NO_CONNECTION: WalletConnection = {
  address: undefined,
  isConnected: false,
  disconnect: () => {},
};

const WalletConnectionContext = createContext<WalletConnection>(NO_CONNECTION);

/** The persisted shape wagmi's own storage middleware writes under `wagmi.store`. */
interface PersistedWalletState {
  state?: {
    current?: string | null;
    connections?: { value?: Array<[string, { accounts?: string[] }]> };
  };
}

function isWalletStore(value: unknown): value is PersistedWalletState {
  return typeof value === "object" && value !== null;
}

/**
 * The connection wagmi itself reconnects from: the current uid's entry in the
 * persisted connections map. Reading it gives the address synchronously, before
 * the wallet chunk loads, without importing wagmi.
 */
function readPersistedAddress(): string | undefined {
  if (!hasWalletSession() || typeof window === "undefined") return undefined;
  try {
    const persisted: unknown = JSON.parse(window.localStorage.getItem("wagmi.store") ?? "null");
    if (!isWalletStore(persisted)) return undefined;
    const { current, connections } = persisted.state ?? {};
    const connection = connections?.value?.find(([uid]) => uid === current);
    return connection?.[1]?.accounts?.[0];
  } catch {
    return undefined;
  }
}

let sessionAddress: string | null = null;
let sessionAddressRead = false;
const sessionAddressListeners = new Set<() => void>();

function sessionAddressSnapshot(): string | null {
  if (!sessionAddressRead) {
    sessionAddress = readPersistedAddress() ?? null;
    sessionAddressRead = true;
  }
  return sessionAddress;
}

function subscribeSessionAddress(listener: () => void): () => void {
  sessionAddressListeners.add(listener);
  return () => {
    sessionAddressListeners.delete(listener);
  };
}

/** The lazy bridge publishes here so an in-tab connect reaches every route. */
function setSessionAddress(address: string | null): void {
  if (sessionAddressSnapshot() === address) return;
  sessionAddress = address;
  sessionAddressRead = true;
  for (const listener of sessionAddressListeners) listener();
}

/** The connected wallet, readable before the wallet chunk loads and outside it. */
export function useWalletAddress(): string | undefined {
  return (
    useSyncExternalStore(subscribeSessionAddress, sessionAddressSnapshot, sessionAddressSnapshot) ??
    undefined
  );
}

/** The wallet chunk is in flight: hold the slot instead of blanking the subtree. */
function WalletPendingShell() {
  return <div aria-hidden="true" className="contents" />;
}

const LazyWagmiProvider = lazy(async () => {
  const [{ WagmiProvider, useConnection, useDisconnect }, config] = await Promise.all([
    import("wagmi"),
    import("@/config/web3").then((module) => module.loadWeb3Config()),
  ]);

  function ConnectionBridge({ children }: { children: ReactNode }) {
    const { address, isConnected, status } = useConnection();
    const { mutate: disconnect } = useDisconnect();
    const wasConnected = useRef(false);

    useEffect(() => {
      // Until reconnection settles the store still holds the last session, so
      // only a real connected -> disconnected transition may clear the address.
      if (status === "connected") {
        wasConnected.current = true;
        if (address === undefined) return;
        setSessionAddress(address);
      } else if (status === "disconnected" && wasConnected.current) {
        setSessionAddress(null);
      }
    }, [address, status]);

    const value = useMemo<WalletConnection>(
      () => ({
        address,
        isConnected,
        disconnect: () => {
          disconnect();
          setSessionAddress(null);
        },
      }),
      [address, isConnected, disconnect],
    );
    return (
      <WalletConnectionContext.Provider value={value}>{children}</WalletConnectionContext.Provider>
    );
  }

  return {
    default: ({ children }: { children: ReactNode }) => (
      <WagmiProvider config={config}>
        <ConnectionBridge>{children}</ConnectionBridge>
      </WagmiProvider>
    ),
  };
});

/** Outside a provider the wagmi core is only reachable on demand. */
async function disconnectWalletSession(): Promise<void> {
  setSessionAddress(null);
  try {
    const [{ disconnect }, config] = await Promise.all([
      import("wagmi/actions"),
      import("@/config/web3").then((module) => module.loadWeb3Config()),
    ]);
    await Promise.all(
      [...config.state.connections.values()].map((connection) =>
        disconnect(config, { connector: connection.connector }),
      ),
    );
  } catch {
    // The session store is already cleared; the next mount starts disconnected.
  }
}

/**
 * The provider's live context inside the lazy boundary, the persisted session
 * outside it: the nav renders above every subtree that mounts a provider.
 */
export function useWalletConnection(): WalletConnection {
  const connection = useContext(WalletConnectionContext);
  const address = useWalletAddress();
  return useMemo<WalletConnection>(() => {
    if (connection !== NO_CONNECTION) return connection;
    return {
      address,
      isConnected: address !== undefined,
      disconnect: () => {
        if (address === undefined) return;
        void disconnectWalletSession();
      },
    };
  }, [connection, address]);
}

export function useWalletAvailable(): boolean {
  const [available] = useState(() => hasWalletSession());
  return available;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const available = useWalletAvailable();

  return available ? (
    <Suspense fallback={<WalletPendingShell />}>
      <LazyWagmiProvider>{children}</LazyWagmiProvider>
    </Suspense>
  ) : (
    children
  );
}
