import { mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { Database } from "bun:sqlite";
import { dataDirectory, databasePath } from "../local-data/paths.ts";
import { migrate } from "./migrations.ts";

export function openDatabase(path = databasePath): Database {
  mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path);
  database.exec("pragma journal_mode = WAL; pragma foreign_keys = ON; pragma busy_timeout = 5000;");
  migrate(database);
  return database;
}

export function ensureDatabase(path = databasePath): void {
  const database = openDatabase(path);
  database.close();
}

export function dataDirectoryExists(path = dataDirectory): boolean {
  try {
    return statSync(path).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
