import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensurePreferences, loadPreferences, parsePreferences, savePreferences } from "@/preferences/index.ts";

const directories: string[] = [];
afterEach(() => { while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true }); });

describe("preferences", () => {
  test("fills omitted settings with defaults", () => {
    expect(parsePreferences({ review: { minimumDays: 14 } })).toEqual({
      review: { minimumDays: 14, minimumAnswersAfter: 100 },
      display: { resultDetail: "standard" },
    });
  });

  test("rejects misspelled and invalid settings", () => {
    expect(() => parsePreferences({ review: { minimumDay: 7 } })).toThrow("unknown review setting");
    expect(() => parsePreferences({ review: { minimumAnswersAfter: -1 } })).toThrow("non-negative integer");
    expect(() => parsePreferences({ display: { resultDetail: "verbose" } })).toThrow("brief, standard, detailed");
  });

  test("round-trips an editable local JSON file", async () => {
    const directory = mkdtempSync(join(tmpdir(), "saterminal-preferences-"));
    directories.push(directory);
    const path = join(directory, "preferences.json");
    const preferences = { review: { minimumDays: 10, minimumAnswersAfter: 150 }, display: { resultDetail: "detailed" as const } };

    await savePreferences(preferences, path);

    expect(await loadPreferences(path)).toEqual(preferences);
    expect(readJson(path)).toMatchObject({ $schema: "./preferences.schema.json" });
    expect(existsSync(join(directory, "preferences.schema.json"))).toBe(true);
  });

  test("materializes defaults and editor schema during local setup", async () => {
    const directory = mkdtempSync(join(tmpdir(), "saterminal-preferences-"));
    directories.push(directory);
    const path = join(directory, "preferences.json");

    await ensurePreferences(path);

    expect(await loadPreferences(path)).toEqual({
      review: { minimumDays: 7, minimumAnswersAfter: 100 },
      display: { resultDetail: "standard" },
    });
    expect(readJson(path)).toMatchObject({ $schema: "./preferences.schema.json" });
    const schemaPath = join(directory, "preferences.schema.json");
    expect(existsSync(schemaPath)).toBe(true);
    expect(readJson(schemaPath)).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      properties: { display: { properties: { resultDetail: { enum: ["brief", "standard", "detailed"] } } } },
    });
  });

  test("migrates the taxonomy visibility preference to a detail level", () => {
    expect(parsePreferences({ display: { showTaxonomy: true } }).display.resultDetail).toBe("detailed");
    expect(parsePreferences({ display: { showTaxonomy: false } }).display.resultDetail).toBe("standard");
  });
});

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}
