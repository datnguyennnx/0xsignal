import type { WhalePositionsApiResponse, WhalePositionsQuery } from "@0xsignal/shared";
import { API_BASE, fetchJson } from "./client";

export function getPositions(params?: WhalePositionsQuery): Promise<WhalePositionsApiResponse> {
  const query = new URLSearchParams();
  if (params?.symbol !== undefined) query.set("symbol", params.symbol);
  if (params?.side !== undefined) query.set("side", params.side);
  if (params?.pnlMin !== undefined) query.set("pnlMin", String(params.pnlMin));
  if (params?.pnlMax !== undefined) query.set("pnlMax", String(params.pnlMax));
  if (params?.fundingMin !== undefined) query.set("fundingMin", String(params.fundingMin));
  if (params?.sort !== undefined) query.set("sort", params.sort);
  if (params?.limit !== undefined) query.set("limit", String(params.limit));
  if (params?.cursor !== undefined) query.set("cursor", params.cursor);
  const qs = query.toString();
  return fetchJson<WhalePositionsApiResponse>(`${API_BASE}/whales/positions?${qs}`);
}
