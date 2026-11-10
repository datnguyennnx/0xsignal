/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { STATE_ART_URL } from "./state-art-url";

const SOURCE = readFileSync(new URL("./state-art-url.ts", import.meta.url), "utf8");

describe("STATE_ART_URL", () => {
  test("is a non-empty string", () => {
    expect(typeof STATE_ART_URL).toBe("string");
    expect(STATE_ART_URL.length).toBeGreaterThan(0);
  });

  test("comes from the bundler's asset import", () => {
    expect(SOURCE).toContain('from "@/assets/state.webp"');
  });
});
