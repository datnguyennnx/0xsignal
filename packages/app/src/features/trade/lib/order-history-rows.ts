import { formatPrice, formatCompactUsd, formatSize } from "@/core/utils/formatters";
import type { UserFill } from "@0xsignal/shared";
import { formatTime } from "../utils/shared-table-utils";

export interface FillRow {
  readonly key: string;
  readonly time: string;
  readonly coin: string;
  readonly dir: UserFill["dir"];
  readonly price: string;
  readonly size: string;
  readonly value: string;
  readonly fee: string;
  readonly pnl: number | null;
  readonly pnlText: string;
}

/** A fill can repeat (same hash and time); the occurrence suffix keeps the row key unique. */
export function prepareFillRows(fills: readonly UserFill[] | undefined): FillRow[] {
  if (fills === undefined || fills.length === 0) return [];

  const seen = new Map<string, number>();
  return fills.map((fill) => {
    const sz = Number(fill.sz);
    const px = Number(fill.px);
    const pnl =
      fill.closedPnl !== undefined && fill.closedPnl !== "" ? Number(fill.closedPnl) : null;
    const base = `${fill.hash}-${fill.time}`;
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);

    return {
      key: `${base}#${occurrence}`,
      time: formatTime(fill.time),
      coin: fill.coin,
      dir: fill.dir,
      price: formatPrice(px),
      size: formatSize(sz),
      value: formatCompactUsd(sz * px),
      fee: formatCompactUsd(Number(fill.fee)),
      pnl,
      pnlText: pnl === null ? "—" : formatCompactUsd(pnl),
    };
  });
}
