import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const attemptsTable = sqliteTable("attempts", {
  questionId: text("question_id").primaryKey(),
  outcome: text("outcome").notNull(),
  updatedAt: text("updated_at").notNull(),
  elapsedSeconds: integer("elapsed_seconds").notNull().default(0),
  difficulty: text("difficulty"),
  domain: text("domain"),
  domainDesc: text("domain_desc"),
  skill: text("skill"),
  skillDesc: text("skill_desc"),
});

export const attemptEventsTable = sqliteTable("attempt_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  questionId: text("question_id").notNull(),
  correct: integer("correct", { mode: "boolean" }).notNull(),
  answeredAt: text("answered_at").notNull(),
  elapsedSeconds: integer("elapsed_seconds").notNull().default(0),
  difficulty: text("difficulty").notNull().default(""),
  domain: text("domain").notNull().default(""),
  domainDesc: text("domain_desc"),
  skill: text("skill").notNull().default(""),
  skillDesc: text("skill_desc"),
});

export const focusTable = sqliteTable("focus", {
  id: integer("id").primaryKey(),
  difficulties: text("difficulties", { mode: "json" }).notNull(),
  domains: text("domains", { mode: "json" }).notNull(),
  skills: text("skills", { mode: "json" }).notNull(),
  updatedAt: text("updated_at").notNull(),
});
