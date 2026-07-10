import type { Focus } from "../questions/focus.ts";
import { defaultFocus, normalizeFocus } from "../questions/focus.ts";
import { databasePath } from "../local-data/paths.ts";
import { openDatabase } from "./index.ts";

export async function loadFocus(path = databasePath): Promise<Focus> {
  const database = await openDatabase(path);
  try {
    const row = database.query("select difficulties, skills from focus where id = 1").get() as { difficulties: string; skills: string } | null;
    return row ? normalizeFocus({ difficulties: JSON.parse(row.difficulties), skills: JSON.parse(row.skills) }) : defaultFocus;
  } finally {
    database.close();
  }
}

export async function saveFocus(focus: Focus, path = databasePath): Promise<void> {
  const normalized = normalizeFocus(focus);
  const database = await openDatabase(path);
  try {
    database.query(`insert into focus (id, difficulties, skills, updated_at) values (1, ?, ?, ?)
      on conflict(id) do update set difficulties = excluded.difficulties, skills = excluded.skills, updated_at = excluded.updated_at`)
      .run(JSON.stringify(normalized.difficulties), JSON.stringify(normalized.skills), new Date().toISOString());
  } finally {
    database.close();
  }
}
