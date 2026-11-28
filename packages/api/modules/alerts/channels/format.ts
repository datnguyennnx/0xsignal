import type { OutboundMessage } from "./types";

const TITLE_MAX = 80;
const BODY_MAX = 700;

const clamp = (text: string, max: number): string => {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
};

export const formatNotice = (
  notice: { ruleName: string; severity: string; summary: string; firedAt: number },
  manageUrl?: string,
): OutboundMessage => {
  const lines = [notice.summary.trim(), `Alert: ${notice.ruleName}`];
  if (manageUrl !== undefined) lines.push(`Manage: ${manageUrl}`);

  return {
    title: clamp(`${notice.severity}: ${notice.ruleName}`, TITLE_MAX),
    body: clamp(lines.join("\n"), BODY_MAX),
  };
};
