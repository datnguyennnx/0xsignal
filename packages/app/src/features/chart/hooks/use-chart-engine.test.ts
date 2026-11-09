/// <reference types="bun-types" />
import { describe, expect, mock, test } from "bun:test";
import type { IChartApi } from "lightweight-charts";

import { createManagedChart } from "./use-chart-engine";

const CONTAINER = {} as HTMLElement;
const OPTIONS = {} as Parameters<typeof createManagedChart>[1];

const fakeChart = (remove: ReturnType<typeof mock>): IChartApi =>
  ({
    remove,
    addSeries: () => {
      throw new Error("boom");
    },
  }) as unknown as IChartApi;

describe("createManagedChart", () => {
  test("removes the chart exactly once when construction throws", () => {
    const remove = mock();
    const chart = fakeChart(remove);

    expect(() =>
      createManagedChart(
        CONTAINER,
        OPTIONS,
        (api) => (api as unknown as { addSeries: () => unknown }).addSeries(),
        () => chart,
      ),
    ).toThrow("boom");
    expect(remove).toHaveBeenCalledTimes(1);
  });

  test("a successful construction leaves removal to cleanup", () => {
    const remove = mock();
    const chart = { remove } as unknown as IChartApi;

    const managed = createManagedChart(
      CONTAINER,
      OPTIONS,
      () => "built",
      () => chart,
    );

    expect(managed.value).toBe("built");
    expect(remove).toHaveBeenCalledTimes(0);

    managed.remove();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
