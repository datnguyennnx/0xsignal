import { useCallback, useState } from "react";
import type { TpSlOrder } from "../components/position-management-modals";

export interface CloseLimitPosition {
  coin: string;
  sz: number;
  isLong: boolean;
  markPx: number;
}

export interface CloseLimitFormValues {
  price: string;
  size: string;
}

export interface SubmitCloseLimitInput {
  coin: string;
  isLong: boolean;
  price: string;
  size: string;
}

/** No position means no order; the modal is already closed in that case. */
export function buildCloseLimitSubmission(
  position: CloseLimitPosition | null,
  values: CloseLimitFormValues,
): SubmitCloseLimitInput | null {
  if (!position) return null;
  return {
    coin: position.coin,
    isLong: position.isLong,
    price: values.price,
    size: values.size,
  };
}

/** The confirm dialog only dismisses once the placement was accepted. */
export function closeLimitAfterSubmit(
  position: CloseLimitPosition | null,
  submitted: boolean,
): CloseLimitPosition | null {
  return submitted ? null : position;
}

export interface PositionModalsStateParams {
  submitCloseLimit: (input: SubmitCloseLimitInput) => boolean;
  cancelAllConfirmed: () => boolean;
}

export function usePositionModalsState({
  submitCloseLimit,
  cancelAllConfirmed,
}: PositionModalsStateParams) {
  const [closeLimitPosition, setCloseLimitPosition] = useState<CloseLimitPosition | null>(null);
  const [tpSlModalOrder, setTpSlModalOrder] = useState<TpSlOrder | null>(null);
  const [cancelAllDialogOpen, setCancelAllDialogOpen] = useState(false);

  const handleCloseLimitConfirm = useCallback(
    (values: CloseLimitFormValues) => {
      const submission = buildCloseLimitSubmission(closeLimitPosition, values);
      if (submission === null) return;
      const submitted = submitCloseLimit(submission);
      setCloseLimitPosition(closeLimitAfterSubmit(closeLimitPosition, submitted));
    },
    [closeLimitPosition, submitCloseLimit],
  );

  const handleCancelAllConfirm = useCallback(() => {
    if (cancelAllConfirmed()) setCancelAllDialogOpen(false);
  }, [cancelAllConfirmed]);

  return {
    closeLimitPosition,
    setCloseLimitPosition,
    tpSlModalOrder,
    setTpSlModalOrder,
    cancelAllDialogOpen,
    setCancelAllDialogOpen,
    handleCloseLimitConfirm,
    handleCancelAllConfirm,
  };
}
