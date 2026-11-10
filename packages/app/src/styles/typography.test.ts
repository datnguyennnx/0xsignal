/// <reference types="bun-types" />
/**
 * Source-level typography contract.
 *
 * The font families live in token declarations and class strings, so there is
 * no rendered DOM to assert without a browser. These checks pin which face each
 * role resolves to so a refactor cannot quietly fall back to the system stack.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const TYPE_ROLES = [
  ".type-display",
  ".type-heading",
  ".type-title",
  ".type-body",
  ".type-label",
  ".type-data",
  ".type-control",
] as const;

const INDEX_HTML = source("../../index.html");
const BASE_CSS = source("./base.css");
const TOKENS_CSS = source("./tokens.scale.css");
const UTILITIES_CSS = source("./utilities.css");

const openOrders = source("../features/trade/components/open-orders-table.tsx");
const fundingRows = source("../features/trade/components/funding-history-rows.tsx");
const orderHistory = source("../features/trade/components/order-history-table.tsx");
const tpSl = source("../features/trade/components/tp-sl-view-modal.tsx");
const marginMode = source("../features/trade/components/margin-mode-options.tsx");
const leverage = source("../features/trade/components/adjust-leverage-panel.tsx");
const interfaceSettings = source("../features/settings/components/interface-settings.tsx");
const tradeTrigger = source("../features/trade/components/trade-dropdown-trigger.tsx");
const coinPriceChart = source("../features/whales/components/coin-price-chart.tsx");
const longShortDonut = source("../features/whales/components/long-short-donut.tsx");
const mainLayout = source("../layouts/main-layout.tsx");

describe("font family tokens", () => {
  test("both sans and display resolve to the SF Pro stack, mono is preserved", () => {
    expect(TOKENS_CSS).toContain("--font-sans:");
    expect(TOKENS_CSS).toContain("--font-display:");
    expect(TOKENS_CSS).toContain("--font-mono:");
    const sans = TOKENS_CSS.slice(
      TOKENS_CSS.indexOf("--font-sans:"),
      TOKENS_CSS.indexOf("--font-display:"),
    );
    const display = TOKENS_CSS.slice(
      TOKENS_CSS.indexOf("--font-display:"),
      TOKENS_CSS.indexOf("--font-mono:"),
    );
    expect(sans).toContain('"SF Pro Text"');
    expect(display).toContain('"SF Pro Display"');
    for (const stack of [sans, display]) {
      expect(stack).not.toContain("Urbanist");
      expect(stack).not.toContain("Bricolage");
      expect(stack).not.toContain("Inter Tight");
    }
  });

  test("body uses the sans token with no webfont axis overrides", () => {
    expect(BASE_CSS).toContain("font-family: var(--font-sans);");
    expect(BASE_CSS).not.toContain("font-optical-sizing");
    expect(BASE_CSS).not.toContain("font-variation-settings");
  });

  test("headings still adopt the display token", () => {
    expect(BASE_CSS).toContain("font-family: var(--font-display);");
  });
});

describe("role mapping", () => {
  const roles = TYPE_ROLES;

  const block = (selector: string) => {
    const start = UTILITIES_CSS.indexOf(`${selector} {`);
    return UTILITIES_CSS.slice(start, UTILITIES_CSS.indexOf("}", start) + 1);
  };

  test("every type role resolves to the one sans family", () => {
    for (const selector of roles) {
      expect(block(selector)).toContain("font-family: var(--font-sans);");
    }
  });

  test("no type role reaches for the display token", () => {
    for (const selector of roles) {
      expect(block(selector)).not.toContain("var(--font-display)");
    }
  });

  test("the split-face helper classes are gone and unreferenced", () => {
    for (const removed of [
      ".type-title-sans",
      ".type-heading-sans",
      ".type-control-display",
      ".type-label-display",
    ]) {
      expect(UTILITIES_CSS).not.toContain(`${removed} {`);
    }
  });
});

const cssBlock = (selector: string) => {
  const start = UTILITIES_CSS.indexOf(`${selector} {`);
  return UTILITIES_CSS.slice(start, UTILITIES_CSS.indexOf("}", start) + 1);
};

describe("weight scale tokens", () => {
  test("every weight step exists with the stated value", () => {
    expect(TOKENS_CSS).toContain("--weight-regular: 400;");
    expect(TOKENS_CSS).toContain("--weight-medium: 500;");
    expect(TOKENS_CSS).toContain("--weight-semibold: 600;");
    expect(TOKENS_CSS).toContain("--weight-bold: 700;");
    expect(TOKENS_CSS).toContain("--weight-extrabold: 800;");
  });
});

describe("font weight baseline", () => {
  const bodyBlock = BASE_CSS.slice(BASE_CSS.indexOf("body {"), BASE_CSS.indexOf("h1,"));

  test("body inherits the regular role weight instead of a thin literal", () => {
    expect(bodyBlock).toContain("font-weight: var(--weight-regular);");
    expect(bodyBlock).not.toContain("font-weight: 400;");
  });

  test("no type role sets a weight in the utilities layer, so weight stays opt-in per component", () => {
    for (const selector of TYPE_ROLES) {
      expect(cssBlock(selector)).not.toContain("font-weight");
    }
  });
});

describe("@layer base role weights", () => {
  const baseLayer = BASE_CSS.slice(BASE_CSS.lastIndexOf("@layer base"));

  test("every role declares its weight where utilities can still win", () => {
    const expected = [
      [".type-display", "--weight-bold"],
      [".type-heading", "--weight-bold"],
      [".type-title", "--weight-semibold"],
      [".type-control", "--weight-medium"],
      [".type-label", "--weight-medium"],
      [".type-data", "--weight-medium"],
      [".type-body", "--weight-regular"],
    ] as const;

    for (const [selector, token] of expected) {
      const start = baseLayer.indexOf(`${selector} {`);
      expect(start).toBeGreaterThan(-1);
      const rule = baseLayer.slice(start, baseLayer.indexOf("}", start) + 1);
      expect(rule).toContain(`font-weight: var(${token});`);
    }
  });
});

describe("nav emphasis", () => {
  test("active nav is bold and inactive is semibold on desktop and mobile", () => {
    expect(mainLayout.match(/"font-bold text-foreground"/g)?.length).toBe(2);
    expect(
      mainLayout.match(/"font-semibold text-muted-foreground hover:text-foreground"/g)?.length,
    ).toBe(2);
    expect(mainLayout.match(/aria-current=/g)?.length).toBe(2);
    expect(
      mainLayout.match(/focus-ring type-title motion-control whitespace-nowrap/g)?.length,
    ).toBe(1);
    expect(mainLayout.match(/focus-ring type-data motion-control/g)?.length).toBe(1);
  });
});

describe("data sites use the single face", () => {
  test("the trigger's market label, base and quote all use type-title", () => {
    expect(tradeTrigger.match(/type-title(?!-)/g)?.length).toBe(3);
    expect(tradeTrigger).not.toContain("type-title-sans");
  });

  test("the coin heading and price use title and heading", () => {
    expect(coinPriceChart).toContain("type-title leading-none font-semibold");
    expect(coinPriceChart).toContain("type-heading leading-none font-semibold tabular-nums");
    expect(coinPriceChart).not.toContain("type-title-sans");
    expect(coinPriceChart).not.toContain("type-heading-sans");
  });

  test("the donut centre figure uses type-title", () => {
    expect(longShortDonut).toContain("type-title leading-none font-semibold tabular-nums");
    expect(longShortDonut).not.toContain("type-title-sans");
  });
});

describe("font loading", () => {
  test("index.html loads no webfont stylesheet and no font preconnects", () => {
    expect(INDEX_HTML).not.toContain('rel="stylesheet"');
    expect(INDEX_HTML).not.toContain("fonts.googleapis.com");
    expect(INDEX_HTML).not.toContain("fonts.gstatic.com");
    expect(INDEX_HTML).not.toContain("family=");
    for (const family of ["Urbanist", "Bricolage", "Inter Tight", "Inter+Tight"]) {
      expect(INDEX_HTML).not.toContain(family);
    }
  });
});

describe("data role numerics", () => {
  test("timestamps carry tabular figures", () => {
    expect(openOrders).toContain("tabular-nums`}>{formatTime(order.timestamp)");
    expect(fundingRows).toContain("tabular-nums`}>{formatTime(entry.time)");
    expect(orderHistory).toContain("tabular-nums`}>{row.time}");
    expect(orderHistory).toContain("tabular-nums`}>{formatTime(entry.statusTimestamp)}");
  });

  test("tp/sl detail values carry tabular figures", () => {
    expect(tpSl).toContain('className={`tabular-nums ${color ?? "text-foreground"}`}');
  });
});

describe("prose in the body role", () => {
  test("descriptive copy uses type-body, not type-data", () => {
    expect(marginMode.match(/type-body text-muted-foreground leading-relaxed/g)?.length).toBe(2);
    expect(leverage).toContain("type-body text-muted-foreground leading-relaxed");
    expect(leverage).toContain("type-body leading-relaxed");
    expect(interfaceSettings).toContain("type-body text-muted-foreground");
  });
});
