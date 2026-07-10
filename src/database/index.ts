import { mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { Database } from "bun:sqlite";
import { dataDirectory, databasePath } from "../local-data/paths.ts";
import { migrate } from "./migrations.ts";

export async function openDatabase(path = databasePath): Promise<Database> {
  await mkdir(dirname(path), { recursive: true });
  const database = new Database(path);
  database.exec("pragma journal_mode = WAL; pragma foreign_keys = ON; pragma busy_timeout = 5000;");
  migrate(database);
  return database;
}

export async function ensureDatabase(path = databasePath): Promise<void> {
  const database = await openDatabase(path);
  database.close();
}

export async function dataDirectoryExists(path = dataDirectory): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}
