/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { AgentRegistration } from "@/services/api";
import { AgentRegistrationsBanner } from "./agent-registrations-warning";

const ADDRESS = `0x${"a".repeat(40)}`;

const registrations: AgentRegistration[] = [
  {
    agentAddress: ADDRESS,
    label: "trading",
    expiresAt: "2030-01-01T00:00:00.000Z",
    isVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "active",
  },
];

describe("agent registrations warning", () => {
  test("lists the address, expiry and status with the remediation copy", () => {
    const html = renderToStaticMarkup(<AgentRegistrationsBanner registrations={registrations} />);

    expect(html).toContain(ADDRESS);
    expect(html).toContain("active");
    expect(html).toContain("no revoke action");
    expect(html).toContain("approve a new agent with the same name");
    expect(html).toContain("https://app.hyperliquid.xyz/API");
    expect(html).not.toContain("Revoke");
  });

  test("renders nothing when the user has no registrations", () => {
    const html = renderToStaticMarkup(<AgentRegistrationsBanner registrations={[]} />);

    expect(html).toBe("");
  });
});
