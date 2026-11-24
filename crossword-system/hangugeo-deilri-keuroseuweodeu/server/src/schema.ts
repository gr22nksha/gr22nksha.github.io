import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const puzzles = sqliteTable("puzzles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(),
  no: integer("no").notNull(),
  themeLine: text("theme_line").notNull(),
  level: text("level").notNull().default("보통"),
  words: text("words").notNull(), // JSON: [{w,r,c,d,clue}]
});

export const progress = sqliteTable("progress", {
  puzzleId: integer("puzzle_id").primaryKey(),
  values: text("values").notNull(), // JSON string[225]
  locked: text("locked").notNull(), // JSON boolean[225]
  revealed: text("revealed").notNull(), // JSON boolean[225]
  startedAt: integer("started_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  solvedAt: integer("solved_at", { mode: "timestamp_ms" }),
  reveals: integer("reveals").notNull().default(0),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  level: text("level").notNull().default("보통"),
  interests: text("interests").notNull().default("[]"), // JSON string[]
});
