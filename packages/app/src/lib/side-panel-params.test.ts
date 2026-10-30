/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import {
  derivePanelDescriptor,
  PANEL_ID_PARAM,
  PANEL_PARAM,
  withPanelParams,
  withoutPanelParams,
} from "./side-panel-params";

const KNOWN_KINDS = new Set(["calendar-day"]);
const isKnownKind = (kind: string): boolean => KNOWN_KINDS.has(kind);

const params = (query: string): URLSearchParams => new URLSearchParams(query);

describe("derivePanelDescriptor", () => {
  test("reads kind and id when the kind is registered", () => {
    expect(
      derivePanelDescriptor(params("panel=calendar-day&panelId=2026-10-30"), isKnownKind),
    ).toEqual({ kind: "calendar-day", id: "2026-10-30" });
  });

  test("ignores unrelated query params", () => {
    expect(
      derivePanelDescriptor(params("tab=profile&panel=calendar-day&panelId=x"), isKnownKind),
    ).toEqual({ kind: "calendar-day", id: "x" });
  });

  test("returns null without a panel param", () => {
    expect(derivePanelDescriptor(params("panelId=2026-10-30"), isKnownKind)).toBeNull();
  });

  test("returns null without a panelId param", () => {
    expect(derivePanelDescriptor(params("panel=calendar-day"), isKnownKind)).toBeNull();
  });

  test("returns null for an empty panelId", () => {
    expect(derivePanelDescriptor(params("panel=calendar-day&panelId="), isKnownKind)).toBeNull();
  });

  test("rejects an unknown kind", () => {
    expect(derivePanelDescriptor(params("panel=whale&panelId=0xabc"), isKnownKind)).toBeNull();
  });
});

describe("withPanelParams", () => {
  test("sets both panel params and keeps the rest", () => {
    const next = withPanelParams(params("tab=profile"), "calendar-day", "2026-10-30");

    expect(next.get(PANEL_PARAM)).toBe("calendar-day");
    expect(next.get(PANEL_ID_PARAM)).toBe("2026-10-30");
    expect(next.get("tab")).toBe("profile");
  });

  test("replaces an already open panel without duplicating params", () => {
    const next = withPanelParams(
      params("panel=calendar-day&panelId=2026-10-01"),
      "calendar-day",
      "2026-10-02",
    );

    expect(next.getAll(PANEL_PARAM)).toEqual(["calendar-day"]);
    expect(next.getAll(PANEL_ID_PARAM)).toEqual(["2026-10-02"]);
  });

  test("does not mutate the input", () => {
    const original = params("tab=profile");
    withPanelParams(original, "calendar-day", "2026-10-30");

    expect(original.get(PANEL_PARAM)).toBeNull();
  });
});

describe("withoutPanelParams", () => {
  test("deletes both panel params and keeps the rest", () => {
    const next = withoutPanelParams(params("tab=profile&panel=calendar-day&panelId=2026-10-30"));

    expect(next.get(PANEL_PARAM)).toBeNull();
    expect(next.get(PANEL_ID_PARAM)).toBeNull();
    expect(next.get("tab")).toBe("profile");
  });

  test("is a no-op when no panel is open", () => {
    const next = withoutPanelParams(params("tab=profile"));

    expect(next.toString()).toBe("tab=profile");
  });

  test("does not mutate the input", () => {
    const original = params("panel=calendar-day&panelId=2026-10-30");
    withoutPanelParams(original);

    expect(original.get(PANEL_PARAM)).toBe("calendar-day");
  });
});
