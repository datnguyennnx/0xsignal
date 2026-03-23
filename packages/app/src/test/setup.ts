/**
 * @overview Global Test Configuration
 *
 * Sets up the testing environment, including JSDOM extensions and React-specific cleanup.
 */
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
