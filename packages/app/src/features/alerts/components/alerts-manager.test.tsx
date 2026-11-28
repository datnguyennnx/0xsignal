/// <reference types="bun-types" />
import { afterAll, describe, expect, mock, test } from "bun:test";

import { hasDom, renderMarkup } from "../../../../test/render";

mock.module("../hooks/use-alerts", () => ({
  useAlerts: () => ({
    state: { status: "empty", reason: "first-use" },
    refetch: () => {},
  }),
}));

const { AlertsManager } = await import("./alerts-manager");

afterAll(() => {
  mock.restore();
});

describe.skipIf(!hasDom)("AlertsManager", () => {
  test("shows the first-use empty state", () => {
    const text = renderMarkup(<AlertsManager />)
      .replaceAll(/<[^>]*>/g, " ")
      .replaceAll(/\s+/g, " ")
      .trim();

    expect(text).toContain("No alerts yet. Create one from a sentence or from the chart.");
  });
});
