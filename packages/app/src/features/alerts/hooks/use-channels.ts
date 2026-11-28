import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toAsyncState } from "@/lib/async-state";
import { queryKeys } from "@/lib/query-keys";
import {
  type AlertChannel,
  createChannelLink,
  deleteAlertChannel,
  listAlertChannels,
  testAlertChannel,
} from "@/services/api/alerts";

async function cancelAndInvalidateChannels(queryClient: QueryClient): Promise<void> {
  await queryClient.cancelQueries({ queryKey: queryKeys.alerts.channels() });
  await queryClient.invalidateQueries({
    queryKey: queryKeys.alerts.channels(),
    refetchType: "active",
  });
}

interface AlertChannelsOptions {
  /** Polls while a link code is waiting for confirmation. */
  poll?: boolean;
}

export function useAlertChannels(options: AlertChannelsOptions = {}) {
  const result = useQuery({
    queryKey: queryKeys.alerts.channels(),
    queryFn: () => listAlertChannels(),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    refetchInterval: options.poll === true ? 5_000 : false,
  });

  const state = toAsyncState({
    isPending: result.isPending,
    isFetching: result.isFetching,
    isError: result.isError,
    error: result.error,
    data: result.data,
    isEmpty: (data) => data.channels.length === 0,
    emptyReason: "first-use",
  });

  return { ...result, state };
}

export function useCreateChannelLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (channel: AlertChannel) => createChannelLink(channel),
    onSuccess: () => {
      void cancelAndInvalidateChannels(queryClient);
    },
  });
}

export function useDeleteAlertChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteAlertChannel(id),
    onSuccess: () => {
      void cancelAndInvalidateChannels(queryClient);
    },
  });
}

export function useTestAlertChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => testAlertChannel(id),
    onSettled: () => {
      void cancelAndInvalidateChannels(queryClient);
    },
  });
}
