/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { AVAILABLE_INDICATORS } from "./config";
import { INDICATOR_REGISTRY, INDICATOR_TYPE } from "./constants";

const TYPE_IDS = Object.values(INDICATOR_TYPE);

describe("indicator registry", () => {
  test("every INDICATOR_TYPE has a registry entry", () => {
    for (const id of TYPE_IDS) {
      expect(INDICATOR_REGISTRY[id]).toBeDefined();
    }
    expect(Object.keys(INDICATOR_REGISTRY)).toHaveLength(TYPE_IDS.length);
  });

  test("every registry catalog id equals its key", () => {
    for (const key of TYPE_IDS) {
      const definition = INDICATOR_REGISTRY[key];
      expect(definition.catalog.id).toBe(key);
      expect(definition.id).toBe(key);
    }
  });

  test("every registry calculator is a function", () => {
    for (const definition of Object.values(INDICATOR_REGISTRY)) {
      expect(typeof definition.calculate).toBe("function");
    }
  });

  test("no duplicate ids across the catalog", () => {
    const ids = AVAILABLE_INDICATORS.map((indicator) => indicator.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(TYPE_IDS.length);
  });
});
