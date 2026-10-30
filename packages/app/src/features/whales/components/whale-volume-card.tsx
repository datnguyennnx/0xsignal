import type { JSX } from "react";

import { Surface } from "@/components/surface/surface";
import { formatCompactUsd, truncateAddress } from "@/core/utils/formatters";

import { sharePercentLabel } from "../hooks/use-coin-market";

const SIDE_TONE = {
  long: "var(--data-up)",
  short: "var(--data-down)",
} as const;

const SUBJECT_CAPTION_CLASS =
  "truncate text-[0.6875rem] leading-4 text-muted-foreground tabular-nums";
const ROW_GRID_CLASS = "grid grid-cols-[3.25rem_minmax(0,1fr)_5rem] items-center gap-2";
const CARD_CLASS = "flex flex-col gap-1 px-2.5 py-3.5";

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
    <ul aria-label="Whales by tracked notional" className="flex flex-col gap-2">
      {whales.map((whale) => {
        const meta = subject !== undefined && whale.address === subject ? subjectMeta : undefined;

        return (
          <Surface
            as="li"
            key={whale.address}
            tier={meta === undefined ? "content" : "solid"}
            radius="control"
            className={CARD_CLASS}
          >
            <div className={ROW_GRID_CLASS}>
              <span
                className="text-[0.6875rem] leading-4 font-medium uppercase tracking-wide"
                style={{ color: SIDE_TONE[whale.side] }}
              >
                {whale.side}
              </span>
              <span
                className="truncate text-xs leading-4 tabular-nums text-muted-foreground"
                title={whale.address}
              >
                {truncateAddress(whale.address)}
              </span>
              <span className="text-right text-xs leading-4 font-medium tabular-nums whitespace-nowrap">
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
