import type { JSX } from "react";

import { Surface } from "@/components/surface/surface";
import { formatCompactUsd, truncateAddress } from "@/core/utils/formatters";

import { sharePercentLabel } from "../hooks/use-coin-market";

const SIDE_TONE = {
  long: "var(--market-up)",
  short: "var(--market-down)",
} as const;

const SUBJECT_CAPTION_CLASS = "truncate type-label text-muted-foreground tabular-nums";
const ROW_GRID_CLASS =
  "grid grid-cols-[3.25rem_minmax(0,1fr)_clamp(4rem,5vw,6rem)] items-center gap-inline";
const CARD_CLASS = "flex flex-col gap-1 px-2 py-3";

interface SubjectMeta {
  rank: number;
  total: number;
  side: "long" | "short";
  sharePercent: number;
}

interface WhaleVolumeCardProps {
  whales: readonly {
    address: string;
    side: "long" | "short";
    notional: number;
  }[];
  subjectAddress?: string | undefined;
  subjectMeta?: SubjectMeta | undefined;
}

function ordinal(value: number): string {
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) return `${value}th`;
  const units = value % 10;
  if (units === 1) return `${value}st`;
  if (units === 2) return `${value}nd`;
  if (units === 3) return `${value}rd`;
  return `${value}th`;
}

function subjectCaption({ rank, total, side, sharePercent }: SubjectMeta): string {
  const share = sharePercentLabel(sharePercent);
  return `This whale · ${ordinal(rank)} of ${total} ${side}s · ${share} of tracked ${side}`;
}

export function WhaleVolumeCard({
  whales,
  subjectAddress,
  subjectMeta,
}: WhaleVolumeCardProps): JSX.Element | null {
  if (whales.length === 0) return null;

  const subject = subjectAddress?.toLowerCase();

  return (
    <ul aria-label="Whales by tracked notional" className="flex flex-col gap-inline">
      {whales.map((whale) => {
        const meta = subject !== undefined && whale.address === subject ? subjectMeta : undefined;

        return (
          <Surface
            as="li"
            key={whale.address}
            tier="content"
            radius="control"
            className={CARD_CLASS}
          >
            <div className={ROW_GRID_CLASS}>
              <span
                className="type-label font-medium uppercase tracking-wide"
                style={{ color: SIDE_TONE[whale.side] }}
              >
                {whale.side}
              </span>
              <span
                className="truncate type-data tabular-nums text-muted-foreground"
                title={whale.address}
              >
                {truncateAddress(whale.address)}
              </span>
              <span className="text-right type-data font-medium tabular-nums whitespace-nowrap">
                {formatCompactUsd(whale.notional)}
              </span>
            </div>
            {meta !== undefined && <p className={SUBJECT_CAPTION_CLASS}>{subjectCaption(meta)}</p>}
          </Surface>
        );
      })}
    </ul>
  );
}
