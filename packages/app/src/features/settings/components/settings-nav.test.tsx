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

function classStringOf(tag: string): string {
  return /class="([^"]*)"/.exec(tag)?.[1] ?? "";
}

function classesOf(tag: string): string[] {
  return classStringOf(tag).split(/\s+/).filter(Boolean);
}

function listTags(markup: string): string[] {
  return markup.match(/<[a-z]+[^>]*data-slot="tabs-list"[^>]*>/g) ?? [];
}

describe("settings nav", () => {
  test("all four tabs share one box: width, padding and surface", () => {
    const tags = tabTags(renderNavMarkup());
    expect(tags).toHaveLength(SETTINGS_NAV_ITEMS.length);

    const reference = classesOf(tags[0]!);
    for (const tag of tags) expect(classesOf(tag)).toEqual(reference);

    const referenceClassString = classStringOf(tags[0]!);
    for (const tag of tags) expect(classStringOf(tag)).toBe(referenceClassString);
  });

  test("nav list is the line variant, not the well surface", () => {
    const lists = listTags(renderNavMarkup());
    expect(lists).toHaveLength(1);

    const listClasses = classesOf(lists[0]!);
    expect(listClasses).not.toContain("tier-well");
    expect(listClasses).toContain("tier-identity");
  });

  test("every trigger is one action row tall", () => {
    const tags = tabTags(renderNavMarkup());
    expect(tags.length).toBeGreaterThan(0);

    for (const tag of tags) expect(classesOf(tag)).toContain("h-(--action-h)!");
  });

  test("every trigger keeps the important active tint", () => {
    const tags = tabTags(renderNavMarkup());
    expect(tags.length).toBeGreaterThan(0);

    for (const tag of tags) {
      expect(classesOf(tag)).toContain("data-active:bg-(--option-card-active-bg)!");
    }
  });

  test("active row is edged, not lifted", () => {
    const tags = tabTags(renderNavMarkup());
    expect(tags.length).toBeGreaterThan(0);

    for (const tag of tags) {
      expect(classesOf(tag)).toContain(
        "data-active:shadow-[inset_0_0_0_1px_var(--control-active-rim)]!",
      );
      expect(classesOf(tag)).not.toContain("data-active:shadow-none!");
    }
  });
});
