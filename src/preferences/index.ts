import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { preferencesPath } from "@/local-data/paths.ts";

export type ReviewPreferences = {
  minimumDays: number;
  minimumAnswersAfter: number;
};

export type Preferences = {
  review: ReviewPreferences;
  display: {
    showTaxonomy: boolean;
  };
};

export const defaultPreferences: Preferences = {
  review: {
    minimumDays: 7,
    minimumAnswersAfter: 100,
  },
  display: {
    showTaxonomy: false,
  },
};

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
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporaryPath, path);
}

export function parsePreferences(value: unknown): Preferences {
  const root = record(value, "preferences");
  knownKeys(root, ["review", "display"], "preferences");
  const review = root.review === undefined ? {} : record(root.review, "review");
  knownKeys(review, ["minimumDays", "minimumAnswersAfter"], "review");
  const display = root.display === undefined ? {} : record(root.display, "display");
  knownKeys(display, ["showTaxonomy"], "display");
  return {
    review: {
      minimumDays: nonNegativeInteger(review.minimumDays, "review.minimumDays", defaultPreferences.review.minimumDays),
      minimumAnswersAfter: nonNegativeInteger(review.minimumAnswersAfter, "review.minimumAnswersAfter", defaultPreferences.review.minimumAnswersAfter),
    },
    display: {
      showTaxonomy: boolean(display.showTaxonomy, "display.showTaxonomy", defaultPreferences.display.showTaxonomy),
    },
  };
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

function boolean(value: unknown, name: string, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new Error(`${name} must be a boolean`);
  return value;
}

function message(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}
