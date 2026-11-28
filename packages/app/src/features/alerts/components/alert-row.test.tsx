/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { describeDeliveryMeta, formatRelativeTime } from "../lib/alert-format";

const NOW = Date.parse("2026-11-26T12:00:00.000Z");
const minutesAgo = (minutes: number): string => new Date(NOW - minutes * 60_000).toISOString();

describe("describeDeliveryMeta", () => {
  test("describes a one-shot alert", () => {
    expect(describeDeliveryMeta({ once: true, cooldown_seconds: 0 })).toBe("In-app · once");
  });

  test("describes a repeating alert from its cooldown", () => {
    expect(describeDeliveryMeta({ once: false, cooldown_seconds: 600 })).toBe(
      "In-app · repeats every 10m",
    );
  });

  test("appends the last fire when known", () => {
    expect(describeDeliveryMeta({ once: false, cooldown_seconds: 600 }, minutesAgo(120), NOW)).toBe(
      "In-app · repeats every 10m · Last fired 2h ago",
    );
  });
});

describe("formatRelativeTime", () => {
  test("formats minutes, hours and days", () => {
    expect(formatRelativeTime(minutesAgo(2), NOW)).toBe("2m ago");
    expect(formatRelativeTime(minutesAgo(180), NOW)).toBe("3h ago");
    expect(formatRelativeTime(minutesAgo(2880), NOW)).toBe("2d ago");
  });
});
