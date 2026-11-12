/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { Tabs } from "@/components/ui/tabs";

import { renderMarkup } from "../../../../test/render";

import { SETTINGS_NAV_ITEMS } from "./settings-nav-model";
import { SettingsNav } from "./settings-nav";

function renderNavMarkup(): string {
  return renderMarkup(
    <Tabs value="profile" orientation="vertical">
      <SettingsNav />
    </Tabs>,
  );
}

function tabTags(markup: string): string[] {
  return markup.match(/<[a-z]+[^>]*data-slot="tabs-trigger"[^>]*>/g) ?? [];
}

function classesOf(tag: string): string[] {
  return (/class="([^"]*)"/.exec(tag)?.[1] ?? "").split(/\s+/).filter(Boolean);
}

describe("settings nav", () => {
  test("all four tabs share one box: width, padding and surface", () => {
    const tags = tabTags(renderNavMarkup());
    expect(tags).toHaveLength(SETTINGS_NAV_ITEMS.length);

    const reference = classesOf(tags[0]!);
    for (const tag of tags) expect(classesOf(tag)).toEqual(reference);
  });
});
