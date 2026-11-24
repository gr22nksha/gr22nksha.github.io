import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const puzzles = sqliteTable("puzzles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(),
  no: integer("no").notNull().unique(),
  themeLine: text("theme_line").notNull(),
  level: text("level", { enum: ["easy", "medium", "hard"] })
    .notNull()
    .default("medium"),
  // JSON array of { w, r, c, d, clue }
  words: text("words").notNull(),
});

export const progress = sqliteTable("progress", {
  puzzleId: integer("puzzle_id")
    .primaryKey()
    .references(() => puzzles.id),
  // JSON arrays of length 225: values are "" or a single letter;
  // locked / revealed are booleans.
  values: text("values").notNull(),
  locked: text("locked").notNull(),
  revealed: text("revealed").notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }),
  solvedAt: integer("solved_at", { mode: "timestamp_ms" }),
  reveals: integer("reveals").notNull().default(0),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  level: text("level", { enum: ["easy", "medium", "hard"] })
    .notNull()
    .default("medium"),
  // JSON array of interest strings.
  interests: text("interests").notNull(),
});
