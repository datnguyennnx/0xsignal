/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { selectAccountView } from "./account-view";

const OWN = "0x0000000000000000000000000000000000000001";
const WHALE = "0x0000000000000000000000000000000000000002";

describe("selectAccountView", () => {
  test("a whale route never reaches the own-address slot", () => {
    const view = selectAccountView({ routeAddress: WHALE, connectionAddress: OWN });
    expect(view.ownAddress).toBe(OWN);
    expect(view.whaleAddress).toBe(WHALE);
  });

  test("inspecting a whale disables signing", () => {
    expect(selectAccountView({ routeAddress: WHALE, connectionAddress: OWN }).signingDisabled).toBe(
      true,
    );
    expect(
      selectAccountView({ routeAddress: WHALE, connectionAddress: undefined }).signingDisabled,
    ).toBe(true);
    expect(
      selectAccountView({ routeAddress: undefined, connectionAddress: OWN }).signingDisabled,
    ).toBe(false);
  });

  test("an invalid route address is ignored and never disables signing", () => {
    const view = selectAccountView({ routeAddress: "not-an-address", connectionAddress: OWN });
    expect(view.whaleAddress).toBeUndefined();
    expect(view.signingDisabled).toBe(false);
  });

  test("own address is connection-only and ignores a route param", () => {
    expect(selectAccountView({ routeAddress: WHALE, connectionAddress: OWN }).ownAddress).toBe(OWN);
    expect(
      selectAccountView({ routeAddress: WHALE, connectionAddress: undefined }).ownAddress,
    ).toBeUndefined();
  });

  test("after a disconnect and reconnect, only the new connection is visible", () => {
    const disconnected = selectAccountView({
      routeAddress: undefined,
      connectionAddress: undefined,
    });
    expect(disconnected.ownAddress).toBeUndefined();
    expect(disconnected.whaleAddress).toBeUndefined();

    const reconnected = selectAccountView({ routeAddress: undefined, connectionAddress: OWN });
    expect(reconnected.ownAddress).toBe(OWN);
    expect(reconnected.whaleAddress).toBeUndefined();
    expect(reconnected.signingDisabled).toBe(false);
  });
});
