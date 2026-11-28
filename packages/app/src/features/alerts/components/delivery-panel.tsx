import { useEffect, useState } from "react";
import { Bell, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { AlertChannel, ChannelRow } from "@/services/api/alerts";

import {
  useAlertChannels,
  useCreateChannelLink,
  useDeleteAlertChannel,
  useTestAlertChannel,
} from "../hooks/use-channels";
import { formatRelativeTime } from "../lib/alert-format";
import { resolveDeliveryState, type DeliveryState, type PendingLink } from "../lib/delivery-state";

const CHANNEL_NAME: Record<AlertChannel, string> = {
  telegram: "Telegram",
};

const OPEN_LABEL: Record<AlertChannel, string> = {
  telegram: "Open Telegram",
};

const CHANNELS: readonly AlertChannel[] = ["telegram"];
const SKELETON_KEYS = ["delivery-skeleton-1", "delivery-skeleton-2", "delivery-skeleton-3"];

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message !== "" ? error.message : fallback;
}

async function copyCode(code: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(code);
    toast.success("Copied");
  } catch {
    toast.error("Couldn't copy the code");
  }
}

function PendingDetails({ channel, link }: { channel: AlertChannel; link: PendingLink }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono tabular-nums select-all">
          {link.code}
        </Badge>
        <Button
          variant="ghost"
          className="h-control! active:scale-[0.96]"
          onClick={() => {
            void copyCode(link.code);
          }}
        >
          Copy
        </Button>
        {link.deepLink === null ? null : (
          <Button
            variant="secondary"
            className="h-control! active:scale-[0.96]"
            render={
              <a
                href={link.deepLink}
                target="_blank"
                rel="noreferrer"
                aria-label={OPEN_LABEL[channel]}
              />
            }
          >
            {OPEN_LABEL[channel]}
          </Button>
        )}
      </div>
      <p className="type-label text-muted-foreground">Waiting for confirmation…</p>
    </div>
  );
}

function ChannelDetails({ channel, state }: { channel: AlertChannel; state: DeliveryState }) {
  switch (state.kind) {
    case "unavailable":
      return <p className="type-label text-muted-foreground">Not configured on this server</p>;
    case "disconnected":
      return <p className="type-label text-muted-foreground">Not connected</p>;
    case "pending":
      return <PendingDetails channel={channel} link={state.link} />;
    case "connected":
      return (
        <p className="min-w-0 truncate type-label tabular-nums text-muted-foreground">
          {state.row.label ?? state.row.destination}
          {state.row.lastSentAt === null
            ? null
            : ` · Last sent ${formatRelativeTime(state.row.lastSentAt)}`}
        </p>
      );
    default:
      return null;
  }
}

interface DeliveryChannelRowProps {
  channel: AlertChannel;
  available: boolean;
  row: ChannelRow | undefined;
  pending: PendingLink | null;
  isTesting: boolean;
  isDeleting: boolean;
  onCreateLink: () => void;
  onCancel: () => void;
  onTest: () => void;
  onUnlink: () => void;
  onRetry: () => void;
}

export function DeliveryChannelRow({
  channel,
  available,
  row,
  pending,
  isTesting,
  isDeleting,
  onCreateLink,
  onCancel,
  onTest,
  onUnlink,
  onRetry,
}: DeliveryChannelRowProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const state = resolveDeliveryState(channel, available, row, pending);
  const name = CHANNEL_NAME[channel];
  const ChannelIcon = channel === "telegram" ? Send : Bell;

  return (
    <li className="flex min-h-[3.5rem] flex-col gap-1 px-panel py-3">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <ChannelIcon
            className="size-icon shrink-0 text-muted-foreground"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate type-control font-semibold text-foreground">{name}</span>
            <ChannelDetails channel={channel} state={state} />
          </div>
        </div>

        {state.kind === "disconnected" ? (
          <Button
            variant="ghost"
            className="h-control! shrink-0 active:scale-[0.96]"
            onClick={onCreateLink}
          >
            Connect
          </Button>
        ) : null}

        {state.kind === "pending" ? (
          <Button
            variant="ghost"
            className="h-control! shrink-0 active:scale-[0.96]"
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}

        {state.kind === "connected" ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              className="h-control! active:scale-[0.96]"
              disabled={isTesting}
              aria-busy={isTesting}
              onClick={onTest}
            >
              {isTesting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Test
            </Button>
            <Button
              variant="ghost"
              className="h-control! active:scale-[0.96]"
              onClick={() => {
                setConfirmOpen(true);
              }}
            >
              Unlink
            </Button>
          </div>
        ) : null}
      </div>

      {row !== undefined && row.lastError !== null ? (
        <div className="flex items-start gap-1.5">
          <p className="line-clamp-2 min-w-0 flex-1 type-data text-muted-foreground">
            {row.lastError}
          </p>
          <Button
            variant="ghost"
            className="h-control! shrink-0 active:scale-[0.96]"
            onClick={onRetry}
          >
            Retry
          </Button>
        </div>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent layout="dialog" className="gap-stack">
          <DialogHeader>
            <DialogTitle>Unlink {name}?</DialogTitle>
            <DialogDescription>Alerts will stop being sent to this channel.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t-0">
            <DialogClose render={<Button variant="secondary" className="h-control!" />}>
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              className="h-control! active:scale-[0.96]"
              disabled={isDeleting}
              onClick={() => {
                setConfirmOpen(false);
                onUnlink();
              }}
            >
              Unlink
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

function InAppRow() {
  return (
    <li className="flex min-h-[3.5rem] items-center gap-4 px-panel py-3">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Bell
          className="size-icon shrink-0 text-muted-foreground"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <span className="truncate type-control font-semibold text-foreground">In-app</span>
      </div>
      <Badge variant="secondary" className="font-normal text-muted-foreground">
        Always on
      </Badge>
    </li>
  );
}

function DeliverySkeleton() {
  return (
    <div
      aria-busy="true"
      className="divide-y divide-border/40 overflow-hidden rounded-panel border border-border/40"
    >
      {SKELETON_KEYS.map((key) => (
        <div key={key} className="flex items-center gap-4 px-panel py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-[1.35em] w-24 type-data" />
            <Skeleton className="h-[1.2em] w-40 type-label" />
          </div>
          <Skeleton className="h-control w-20" />
        </div>
      ))}
    </div>
  );
}

export function DeliveryPanel() {
  const [pending, setPending] = useState<PendingLink | null>(null);
  const { data, isError, refetch } = useAlertChannels({ poll: pending !== null });
  const createLink = useCreateChannelLink();
  const deleteChannel = useDeleteAlertChannel();
  const testChannel = useTestAlertChannel();

  // A code stops being valid at `expiresAt`; polling must stop with it.
  useEffect(() => {
    if (pending === null) return () => {};
    const remaining = Date.parse(pending.expiresAt) - Date.now();
    const timer = setTimeout(
      () => {
        setPending(null);
      },
      Math.max(0, remaining),
    );
    return () => {
      clearTimeout(timer);
    };
  }, [pending]);

  const confirmed =
    pending !== null &&
    data !== undefined &&
    data.channels.some(
      (channel) => channel.channel === pending.channel && channel.verifiedAt !== null,
    );
  const activePending = confirmed ? null : pending;

  const handleConnect = (channel: AlertChannel) => {
    createLink.mutate(channel, {
      onSuccess: (link) => {
        setPending({ channel, ...link });
      },
      onError: (error) => {
        toast.error(errorText(error, "Couldn't create a link"));
      },
    });
  };

  const handleTest = (row: ChannelRow) => {
    testChannel.mutate(row.id, {
      onSuccess: () => {
        toast.success("Test message sent");
      },
      onError: (error) => {
        toast.error(errorText(error, "Couldn't send the test"));
      },
    });
  };

  const handleUnlink = (row: ChannelRow) => {
    setPending(null);
    deleteChannel.mutate(row.id, {
      onSuccess: () => {
        toast.success(`${CHANNEL_NAME[row.channel]} unlinked`);
      },
      onError: (error) => {
        toast.error(errorText(error, "Couldn't unlink the channel"));
      },
    });
  };

  const activeCount =
    data === undefined
      ? null
      : 1 + data.channels.filter((channel) => channel.verifiedAt !== null).length;

  return (
    <section aria-labelledby="delivery-heading" className="flex flex-col">
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id="delivery-heading"
          className="type-label font-medium tracking-wider text-muted-foreground uppercase"
        >
          Delivery
        </h2>
        {activeCount === null ? null : (
          <span className="type-label tabular-nums text-muted-foreground">
            {activeCount} active
          </span>
        )}
      </div>
      <p className="mt-[0.5rem] type-label text-muted-foreground">Where alerts are sent.</p>

      <div className="mt-[0.75rem]">
        {isError && data === undefined ? (
          <div className="flex items-center justify-between gap-4 rounded-panel border border-border/40 p-panel">
            <p className="type-label text-muted-foreground">{"Couldn't load delivery channels."}</p>
            <Button
              variant="secondary"
              className="h-control! active:scale-[0.96]"
              onClick={() => {
                void refetch();
              }}
            >
              Retry
            </Button>
          </div>
        ) : data === undefined ? (
          <DeliverySkeleton />
        ) : (
          <ul
            aria-label="Delivery channels"
            className="divide-y divide-border/40 overflow-hidden rounded-panel border border-border/40"
          >
            <InAppRow />
            {CHANNELS.map((channel) => {
              const row = data.channels.find((candidate) => candidate.channel === channel);
              return (
                <DeliveryChannelRow
                  key={channel}
                  channel={channel}
                  available={data.available[channel]}
                  row={row}
                  pending={activePending}
                  isTesting={testChannel.isPending && testChannel.variables === row?.id}
                  isDeleting={deleteChannel.isPending && deleteChannel.variables === row?.id}
                  onCreateLink={() => {
                    handleConnect(channel);
                  }}
                  onCancel={() => {
                    setPending(null);
                  }}
                  onTest={() => {
                    if (row !== undefined) handleTest(row);
                  }}
                  onUnlink={() => {
                    if (row !== undefined) handleUnlink(row);
                  }}
                  onRetry={() => {
                    if (row !== undefined) handleTest(row);
                  }}
                />
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
