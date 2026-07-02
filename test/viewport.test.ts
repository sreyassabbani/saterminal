import { describe, expect, test } from "bun:test";
import {
  clampScroll,
  ensureRangeVisible,
  ensureRowVisible,
  maxScroll,
  scrollBy,
  scrollPage,
  scrollToEdge,
} from "../src/tui/viewport.ts";

describe("viewport", () => {
  test("clamps scroll to the available content", () => {
    expect(maxScroll({ scroll: 0, height: 5, contentRows: 12 })).toBe(7);
    expect(clampScroll({ scroll: -3, height: 5, contentRows: 12 })).toBe(0);
    expect(clampScroll({ scroll: 20, height: 5, contentRows: 12 })).toBe(7);
    expect(clampScroll({ scroll: 20, height: 5, contentRows: 3 })).toBe(0);
  });

  test("scrolls by lines and pages", () => {
    const viewport = { scroll: 4, height: 5, contentRows: 20 };

    expect(scrollBy(viewport, 2)).toBe(6);
    expect(scrollBy(viewport, -10)).toBe(0);
    expect(scrollPage(viewport, 1)).toBe(8);
    expect(scrollPage(viewport, -1)).toBe(0);
    expect(scrollToEdge(viewport, "bottom")).toBe(15);
  });

  test("keeps a selected row or wrapped range visible", () => {
    const viewport = { scroll: 4, height: 5, contentRows: 20 };

    expect(ensureRowVisible(viewport, 3)).toBe(3);
    expect(ensureRowVisible(viewport, 8)).toBe(4);
    expect(ensureRowVisible(viewport, 12)).toBe(8);
    expect(ensureRangeVisible(viewport, 11, 13)).toBe(9);
    expect(ensureRangeVisible(viewport, 5, 7)).toBe(4);
  });
});
