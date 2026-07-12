import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { preferencesPath } from "@/local-data/paths.ts";

export const resultDetailLevels = ["brief", "standard", "detailed"] as const;
export type ResultDetail = typeof resultDetailLevels[number];
export const bundledPreferencesSchemaPath = fileURLToPath(new URL("./preferences.schema.json", import.meta.url));

export type ReviewPreferences = {
  minimumDays: number;
  minimumAnswersAfter: number;
};

export type Preferences = {
  review: ReviewPreferences;
  display: {
    resultDetail: ResultDetail;
  };
};

export const defaultPreferences: Preferences = {
  review: {
    minimumDays: 7,
    minimumAnswersAfter: 100,
  },
  display: {
    resultDetail: "standard",
  },
};

export function ensurePreferences(path = preferencesPath): void {
  if (existsSync(path)) savePreferences(loadPreferences(path), path);
  else savePreferences(defaultPreferences, path);
}

export function loadPreferences(path = preferencesPath): Preferences {
  let source: string;
  try {
    source = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(defaultPreferences);
    throw error;
  }

  try {
    return parsePreferences(JSON.parse(source));
  } catch (error) {
    throw new Error(`Invalid preferences at ${path}: ${message(error)}`);
  }
}

export function savePreferences(preferences: Preferences, path = preferencesPath): void {
  const normalized = parsePreferences(preferences);
  mkdirSync(dirname(path), { recursive: true });
  writePreferencesSchema(path);
  const temporaryPath = `${path}.${process.pid}.tmp`;
  const document = { $schema: `./${basename(schemaPathFor(path))}`, ...normalized };
  writeFileSync(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporaryPath, path);
}

export function parsePreferences(value: unknown): Preferences {
  const root = record(value, "preferences");
  knownKeys(root, ["$schema", "review", "display"], "preferences");
  if (root.$schema !== undefined && typeof root.$schema !== "string") throw new Error("$schema must be a string");
  const review = root.review === undefined ? {} : record(root.review, "review");
  knownKeys(review, ["minimumDays", "minimumAnswersAfter"], "review");
  const display = root.display === undefined ? {} : record(root.display, "display");
  knownKeys(display, ["resultDetail", "showTaxonomy"], "display");
  const legacyTaxonomy = optionalBoolean(display.showTaxonomy, "display.showTaxonomy");
  return {
    review: {
      minimumDays: nonNegativeInteger(review.minimumDays, "review.minimumDays", defaultPreferences.review.minimumDays),
      minimumAnswersAfter: nonNegativeInteger(review.minimumAnswersAfter, "review.minimumAnswersAfter", defaultPreferences.review.minimumAnswersAfter),
    },
    display: {
      resultDetail: resultDetail(display.resultDetail, legacyTaxonomy),
    },
  };
}

function writePreferencesSchema(path: string): void {
  const schemaPath = schemaPathFor(path);
  const temporaryPath = `${schemaPath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, readFileSync(bundledPreferencesSchemaPath), { mode: 0o600 });
  renameSync(temporaryPath, schemaPath);
}

function schemaPathFor(path: string): string {
  return join(dirname(path), "preferences.schema.json");
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function knownKeys(value: Record<string, unknown>, allowed: readonly string[], name: string): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new Error(`unknown ${name} setting: ${unknown}`);
}

function nonNegativeInteger(value: unknown, name: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || (value as number) < 0) throw new Error(`${name} must be a non-negative integer`);
  return value as number;
}

function optionalBoolean(value: unknown, name: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error(`${name} must be a boolean`);
  return value;
}

function resultDetail(value: unknown, legacyTaxonomy: boolean | undefined): ResultDetail {
  if (value === undefined) {
    if (legacyTaxonomy !== undefined) return legacyTaxonomy ? "detailed" : "standard";
    return defaultPreferences.display.resultDetail;
  }
  if (!resultDetailLevels.includes(value as ResultDetail)) {
    throw new Error(`display.resultDetail must be one of: ${resultDetailLevels.join(", ")}`);
  }
  return value as ResultDetail;
}

function message(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}
