/// <reference types="bun-types" />
import { afterAll, describe, expect, mock, test } from "bun:test";
import type { ReactElement } from "react";

import type { AlertChannels, ChannelRow } from "@/services/api/alerts";

import { hasDom, renderMarkup } from "../../../../test/render";

let channelResponse: AlertChannels = {
  channels: [],
  available: { telegram: true },
};

const noopMutation = () => ({ mutate: () => {}, isPending: false, variables: undefined });

mock.module("../hooks/use-channels", () => ({
  useAlertChannels: () => ({ data: channelResponse, isError: false, refetch: () => {} }),
  useCreateChannelLink: noopMutation,
  useDeleteAlertChannel: noopMutation,
  useTestAlertChannel: noopMutation,
}));

const { DeliveryPanel, DeliveryChannelRow } = await import("./delivery-panel");

afterAll(() => {
  mock.restore();
});

function textOf(element: ReactElement): string {
  return renderMarkup(element)
    .replaceAll(/<[^>]*>/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function connectedRow(overrides: Partial<ChannelRow> = {}): ChannelRow {
  return {
    id: "channel-1",
    channel: "telegram",
    destination: "@trader",
    label: "Trader",
    verifiedAt: "2026-11-26T12:00:00.000Z",
    lastError: null,
    lastSentAt: "2026-11-26T11:58:00.000Z",
    ...overrides,
  };
}

const rowHandlers = {
  onCreateLink: () => {},
  onCancel: () => {},
  onTest: () => {},
  onUnlink: () => {},
  onRetry: () => {},
};

describe.skipIf(!hasDom)("DeliveryPanel", () => {
  test("shows a not-configured row when the server has no adapter", () => {
    channelResponse = {
      channels: [],
      available: { telegram: false },
    };

    expect(textOf(<DeliveryPanel />)).toContain("Not configured on this server");
  });

  test("shows the connected label and the Test action", () => {
    channelResponse = {
      channels: [connectedRow()],
      available: { telegram: true },
    };

    const text = textOf(<DeliveryPanel />);

    expect(text).toContain("Trader");
    expect(text).toContain("Test");
  });

  test("shows the code and the deep link while waiting for confirmation", () => {
    const text = textOf(
      <DeliveryChannelRow
        channel="telegram"
        available
        row={undefined}
        pending={{
          channel: "telegram",
          code: "ABC12345",
          expiresAt: "2099-01-01T00:00:00.000Z",
          deepLink: "https://t.me/0xsignal_bot?start=ABC12345",
        }}
        isTesting={false}
        isDeleting={false}
        {...rowHandlers}
      />,
    );

    expect(text).toContain("ABC12345");
    expect(text).toContain("Open Telegram");
    expect(text).toContain("Waiting for confirmation…");
  });

  test("renders the last error and its retry action", () => {
    channelResponse = {
      channels: [connectedRow({ lastError: "Chat not found" })],
      available: { telegram: true },
    };

    const text = textOf(<DeliveryPanel />);

    expect(text).toContain("Chat not found");
    expect(text).toContain("Retry");
  });
});
