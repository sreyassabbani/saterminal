import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadPreferences, parsePreferences, savePreferences } from "@/preferences/index.ts";

const directories: string[] = [];
afterEach(() => { while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true }); });

describe("preferences", () => {
  test("fills omitted settings with defaults", () => {
    expect(parsePreferences({ review: { minimumDays: 14 } })).toEqual({
      review: { minimumDays: 14, minimumAnswersAfter: 100 },
    });
  });

  test("rejects misspelled and invalid settings", () => {
    expect(() => parsePreferences({ review: { minimumDay: 7 } })).toThrow("unknown review setting");
    expect(() => parsePreferences({ review: { minimumAnswersAfter: -1 } })).toThrow("non-negative integer");
  });

  test("round-trips an editable local JSON file", () => {
    const directory = mkdtempSync(join(tmpdir(), "saterminal-preferences-"));
    directories.push(directory);
    const path = join(directory, "preferences.json");
    const preferences = { review: { minimumDays: 10, minimumAnswersAfter: 150 } };

    savePreferences(preferences, path);

    expect(loadPreferences(path)).toEqual(preferences);
  });
});
