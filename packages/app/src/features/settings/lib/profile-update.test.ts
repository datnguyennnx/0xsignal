/// <reference types="bun-types" />
import { afterEach, describe, expect, test } from "bun:test";

import type { AuthMeResponse } from "@0xsignal/shared";

import { useAuthStore } from "@/stores/use-auth-store";

import { applyProfileUpdate, mergeProfileUser } from "./profile-update";

const USER: AuthMeResponse = {
  userId: "user-1",
  provider: "google",
  avatarUrl: null,
  displayName: "Ada",
};

const reset = (user: AuthMeResponse | null): void => {
  useAuthStore.setState({ user });
};

afterEach(() => {
  reset(null);
});

describe("mergeProfileUser", () => {
  test("uses the profile response as the account truth", () => {
    expect(mergeProfileUser(USER, { ...USER, displayName: "Grace" })).toEqual({
      ...USER,
      displayName: "Grace",
    });
  });

  test("does not invent a user when none is stored", () => {
    expect(mergeProfileUser(null, { ...USER, displayName: "Grace" }).displayName).toBe("Grace");
  });
});

describe("applyProfileUpdate", () => {
  test("writes the new display name into the auth store", () => {
    reset(USER);

    applyProfileUpdate({ ...USER, displayName: "Grace" });

    expect(useAuthStore.getState().user).toEqual({ ...USER, displayName: "Grace" });
  });

  test("leaves a signed-out store untouched", () => {
    reset(null);

    applyProfileUpdate({ ...USER, displayName: "Grace" });

    expect(useAuthStore.getState().user).toBeNull();
  });
});
