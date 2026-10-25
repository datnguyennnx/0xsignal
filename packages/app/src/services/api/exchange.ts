import type {
  OrderIntentRequest,
  OrderIntentResponse,
  OrderIntentResultRequest,
  OrderIntentResultResponse,
} from "@0xsignal/shared";
import { API_BASE, fetchJson } from "./client";

/** Records the unsigned intent before the browser opens the wallet. */
export function requestOrderIntent(input: OrderIntentRequest): Promise<OrderIntentResponse> {
  return fetchJson<OrderIntentResponse>(`${API_BASE}/exchange/intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/** Reports the signed action's id (or the rejection) for the audit trail. */
export function reportOrderIntentResult(
  intentId: string,
  result: OrderIntentResultRequest,
): Promise<OrderIntentResultResponse> {
  return fetchJson<OrderIntentResultResponse>(
    `${API_BASE}/exchange/intent/${encodeURIComponent(intentId)}/result`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    },
  );
}
