import type { Rule } from "@0xsignal/shared/alerts/index.ts";
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import type { ApiRule } from "@/services/api/alerts";

async function cancelAndInvalidateAlerts(queryClient: QueryClient): Promise<void> {
  await queryClient.cancelQueries({ queryKey: queryKeys.alerts.all });
  await queryClient.invalidateQueries({
    queryKey: queryKeys.alerts.all,
    refetchType: "active",
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: Rule) => {
      const { createAlert } = await import("@/services/api/alerts");
      return createAlert(rule);
    },
    onSuccess: () => {
      void cancelAndInvalidateAlerts(queryClient);
    },
  });
}

export function useUpdateAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { updateAlert } = await import("@/services/api/alerts");
      return updateAlert(id, { enabled });
    },
    onMutate: async ({ id, enabled }) => {
      const queryKey = queryKeys.alerts.list();
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ApiRule[]>(queryKey);

      queryClient.setQueryData<ApiRule[]>(queryKey, (rules) =>
        rules?.map((rule) => (rule.id === id ? { ...rule, enabled } : rule)),
      );

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.alerts.list(), context.previous);
      }
    },
    onSettled: () => {
      void cancelAndInvalidateAlerts(queryClient);
    },
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { deleteAlert } = await import("@/services/api/alerts");
      await deleteAlert(id);
    },
    onSuccess: () => {
      void cancelAndInvalidateAlerts(queryClient);
    },
  });
}
