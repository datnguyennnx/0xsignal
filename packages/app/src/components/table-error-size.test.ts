/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const TABLE_ROW = readFileSync(new URL("./table-empty-row.tsx", import.meta.url), "utf8");
const WHALE_TABLE = readFileSync(
  new URL("../features/whales/components/whale-positions-table.tsx", import.meta.url),
  "utf8",
);

describe("table-scale error art", () => {
  test("table-empty-row passes the small size to ErrorState", () => {
    expect(TABLE_ROW).toContain('size="sm"');
  });

  test("whale-positions-table passes the small size to ErrorState", () => {
    expect(WHALE_TABLE).toContain('size="sm"');
  });
});
