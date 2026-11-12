import { useMemo, type ReactNode } from "react";
import type { ClearinghouseState } from "@0xsignal/shared";

import { useOpenCoin } from "@/components/app-side-panel-context";
import { Region } from "@/components/region";
import { Surface } from "@/components/surface/surface";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCompactUsd,
  formatPrice,
  formatSignedPercent,
  formatSignedUsd,
  formatSize,
} from "@/core/utils/formatters";
import { toAsyncState } from "@/lib/async-state";

import { useWhaleClearinghouseState } from "../hooks/use-portfolio-data";

const SURFACE = "h-full min-h-0 flex flex-col p-panel gap-stack";
const CELL = "px-2 py-1";
const CELL_NUM = "px-2 py-1 text-right tabular-nums";

const SKELETON_ROW_KEYS = Array.from({ length: 3 }, (_, index) => `position-row-${index}`);

function toneClass(value: number): string {
  return value >= 0 ? "text-gain" : "text-loss";
}

type Position = ClearinghouseState["assetPositions"][number]["position"];

interface PositionColumn {
  label: string;
  /** Right-aligned tabular cells; the header and the skeleton read the same flag. */
  numeric: boolean;
  cell: (position: Position, onOpenCoin: (coin: string) => void) => ReactNode;
}

/** One ordered descriptor drives the header, the skeleton and the body, so the eight columns cannot drift. */
const POSITION_COLUMNS: readonly PositionColumn[] = [
  {
    label: "Asset",
    numeric: false,
    cell: (position, onOpenCoin) => (
      <button
        type="button"
        onClick={() => {
          onOpenCoin(position.coin);
        }}
        className="font-medium underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {position.coin}
      </button>
    ),
  },
  {
    label: "Side",
    numeric: false,
    cell: (position) => {
      const signedSize = Number(position.szi);
      return (
        <span className={signedSize >= 0 ? "text-gain" : "text-loss"}>
          {signedSize >= 0 ? "Long" : "Short"}
        </span>
      );
    },
  },
  {
    label: "Size",
    numeric: true,
    cell: (position) => `${formatSize(Math.abs(Number(position.szi)))} ${position.coin}`,
  },
  {
    label: "Notional",
    numeric: true,
    cell: (position) => formatCompactUsd(Number(position.positionValue)),
  },
  {
    label: "PnL",
    numeric: true,
    cell: (position) => (
      <span className={toneClass(Number(position.unrealizedPnl))}>
        {formatSignedUsd(Number(position.unrealizedPnl))}{" "}
        {formatSignedPercent(Number(position.returnOnEquity) * 100)}
      </span>
    ),
  },
  {
    label: "Entry",
    numeric: true,
    cell: (position) => formatPrice(Number(position.entryPx)),
  },
  {
    label: "Liq.",
    numeric: true,
    cell: (position) =>
      position.liquidationPx === null || Number(position.liquidationPx) === 0
        ? "—"
        : formatPrice(Number(position.liquidationPx)),
  },
  {
    label: "Leverage",
    numeric: false,
    cell: (position) => (
      <span className="text-muted-foreground">
        {position.leverage.type === "isolated"
          ? `Isolated ${position.leverage.value}x`
          : `Cross ${position.leverage.value}x`}
      </span>
    ),
  },
];

function columnClass(column: PositionColumn): string {
  return column.numeric ? CELL_NUM : CELL;
}

function PositionRow({
  position,
  onOpenCoin,
}: {
  position: Position;
  onOpenCoin: (coin: string) => void;
}) {
  return (
    <TableRow>
      {POSITION_COLUMNS.map((column) => (
        <TableCell key={column.label} className={columnClass(column)}>
          {column.cell(position, onOpenCoin)}
        </TableCell>
      ))}
    </TableRow>
  );
}

function PositionsSkeleton() {
  return (
    <>
      <Skeleton className="h-5 w-32" />
      <Table aria-hidden="true">
        <TableBody>
          {SKELETON_ROW_KEYS.map((rowKey) => (
            <TableRow key={rowKey} className="hover:bg-transparent">
              {POSITION_COLUMNS.map((column) => (
                <TableCell key={column.label} className={columnClass(column)}>
                  <Skeleton className="h-[1.2em] w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

/** Read-only open positions for one third-party account. */
export function WhaleAccountPositions({ address }: { address: string }) {
  const { data, isLoading, isError, refetch } = useWhaleClearinghouseState(address);
  const openCoin = useOpenCoin();

  const positions = useMemo(
    () =>
      data?.assetPositions.map((entry) => entry.position).filter((p) => Number(p.szi) !== 0) ?? [],
    [data],
  );

  const state = toAsyncState({
    isPending: isLoading,
    isError,
    data,
    isEmpty: () => positions.length === 0,
  });

  return (
    <Surface tier="content" radius="panel" className={`${SURFACE} overflow-hidden`}>
      <Region
        state={state}
        label="Whale open positions"
        className="flex min-h-0 flex-1 flex-col gap-stack"
        skeleton={<PositionsSkeleton />}
        empty={{
          title: "No open positions",
          description: "This account has no open perps positions.",
        }}
        error={{
          title: "Unable to load positions",
          description: "This account's open positions could not be loaded.",
          retry: () => {
            void refetch();
          },
        }}
      >
        {() => (
          <>
            <h2 className="px-4 pt-4 pb-2 type-title font-semibold">Open Positions</h2>
            <Table aria-label="Whale open positions">
              <TableHeader>
                <TableRow>
                  {POSITION_COLUMNS.map((column) => (
                    <TableHead key={column.label} className={columnClass(column)}>
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((position) => (
                  <PositionRow key={position.coin} position={position} onOpenCoin={openCoin} />
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Region>
    </Surface>
  );
}
