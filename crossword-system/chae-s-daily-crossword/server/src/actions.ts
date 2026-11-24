import { defineAction, z, type ActionsModule } from "@hatch/space-sdk";
import { asc, eq } from "drizzle-orm";
import * as schema from "./schema";

const SIZE = 225;

const wordSchema = z.object({
  w: z
    .string()
    .min(2)
    .regex(/^[A-Z]+$/, "answer must be uppercase A-Z letters"),
  r: z.number().int().min(0).max(14),
  c: z.number().int().min(0).max(14),
  d: z.enum(["A", "D"]),
  clue: z.string().min(1),
});

const levelSchema = z.enum(["easy", "medium", "hard"]);

const puzzleOut = z.object({
  id: z.number(),
  date: z.string(),
  no: z.number(),
  theme_line: z.string(),
  level: levelSchema,
  words: z.array(wordSchema),
});

const progressOut = z.object({
  puzzle_id: z.number(),
  values: z.array(z.string()),
  locked: z.array(z.boolean()),
  revealed: z.array(z.boolean()),
  started_at: z.string().nullable(),
  solved_at: z.string().nullable(),
  reveals: z.number(),
});

type Word = z.infer<typeof wordSchema>;

function parseWords(json: string): Word[] {
  try {
    const parsed: unknown = JSON.parse(json);
    const result = z.array(wordSchema).safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

function parseBoolArray(json: string): boolean[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return Array.from({ length: SIZE }, (_, i) => parsed[i] === true);
    }
  } catch {
    /* fall through */
  }
  return Array.from({ length: SIZE }, () => false);
}

function parseValues(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return Array.from({ length: SIZE }, (_, i) => {
        const v = parsed[i];
        return typeof v === "string" ? v.slice(0, 1).toUpperCase() : "";
      });
    }
  } catch {
    /* fall through */
  }
  return Array.from({ length: SIZE }, () => "");
}

function validateGrid(words: Word[]): string | null {
  const grid = new Map<number, string>();
  for (const word of words) {
    for (let i = 0; i < word.w.length; i++) {
      const r = word.d === "D" ? word.r + i : word.r;
      const c = word.d === "A" ? word.c + i : word.c;
      if (r < 0 || r > 14 || c < 0 || c > 14) {
        return `Word ${word.w} runs off the 15x15 grid.`;
      }
      const idx = r * 15 + c;
      const existing = grid.get(idx);
      const ch = word.w[i] ?? "";
      if (existing !== undefined && existing !== ch) {
        return `Word ${word.w} conflicts with another answer at row ${r + 1}, column ${c + 1}.`;
      }
      grid.set(idx, ch);
    }
  }
  return null;
}

const getStateResponse = z.object({
  puzzles: z.array(puzzleOut),
  progress: z.array(progressOut),
  settings: z.object({
    level: levelSchema,
    interests: z.array(z.string()),
  }),
});

const addPuzzleResponse = z.object({
  ok: z.boolean(),
  id: z.number().nullable(),
  message: z.string(),
});

const todayStatusResponse = z.object({
  date: z.string(),
  puzzle_date: z.string().nullable(),
  puzzle_no: z.number().nullable(),
  finished: z.boolean(),
  late: z.boolean(),
});

export const Actions = {
  getState: defineAction({
    description:
      "Loads every crossword puzzle, all saved per-puzzle progress, and the settings for the crossword page.",
    request: z.object({}),
    response: getStateResponse,
    async handler(ctx): Promise<z.infer<typeof getStateResponse>> {
      const db = ctx.db<typeof schema>();
      const puzzleRows = await db
        .select()
        .from(schema.puzzles)
        .orderBy(asc(schema.puzzles.date), asc(schema.puzzles.no));
      const progressRows = await db.select().from(schema.progress);
      const settingsRows = await db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.id, 1));
      const settingsRow = settingsRows[0];
      let interests: string[] = [
        "social housing",
        "artificial intelligence",
        "automation",
        "Seoul",
      ];
      if (settingsRow) {
        try {
          const parsed: unknown = JSON.parse(settingsRow.interests);
          if (Array.isArray(parsed)) {
            interests = parsed.filter(
              (v): v is string => typeof v === "string",
            );
          }
        } catch {
          /* keep defaults */
        }
      }
      return {
        puzzles: puzzleRows.map((row) => ({
          id: row.id,
          date: row.date,
          no: row.no,
          theme_line: row.themeLine,
          level: row.level,
          words: parseWords(row.words),
        })),
        progress: progressRows.map((row) => ({
          puzzle_id: row.puzzleId,
          values: parseValues(row.values),
          locked: parseBoolArray(row.locked),
          revealed: parseBoolArray(row.revealed),
          started_at: row.startedAt ? row.startedAt.toISOString() : null,
          solved_at: row.solvedAt ? row.solvedAt.toISOString() : null,
          reveals: row.reveals,
        })),
        settings: {
          level: settingsRow?.level ?? "medium",
          interests,
        },
      };
    },
  }),

  saveProgress: defineAction({
    description:
      "Saves one puzzle's in-progress grid (letters, locked and revealed cells, reveal count, solved flag) without touching any other puzzle.",
    request: z.object({
      puzzle_id: z.number().int().positive(),
      values: z.array(z.string().max(1)).length(SIZE),
      locked: z.array(z.boolean()).length(SIZE),
      revealed: z.array(z.boolean()).length(SIZE),
      reveals: z.number().int().min(0),
      solved: z.boolean(),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select()
        .from(schema.progress)
        .where(eq(schema.progress.puzzleId, args.puzzle_id));
      const prev = existing[0];
      const now = new Date();
      const startedAt = prev?.startedAt ?? now;
      const solvedAt = args.solved ? (prev?.solvedAt ?? now) : null;
      const valuesJson = JSON.stringify(
        args.values.map((v) => v.toUpperCase().replace(/[^A-Z]/g, "")),
      );
      if (prev) {
        await db
          .update(schema.progress)
          .set({
            values: valuesJson,
            locked: JSON.stringify(args.locked),
            revealed: JSON.stringify(args.revealed),
            startedAt,
            solvedAt,
            reveals: args.reveals,
          })
          .where(eq(schema.progress.puzzleId, args.puzzle_id));
      } else {
        await db.insert(schema.progress).values({
          puzzleId: args.puzzle_id,
          values: valuesJson,
          locked: JSON.stringify(args.locked),
          revealed: JSON.stringify(args.revealed),
          startedAt,
          solvedAt,
          reveals: args.reveals,
        });
      }
      return { ok: true as const };
    },
  }),

  setLevel: defineAction({
    description:
      "Sets the difficulty level used for the next puzzles and saves it in settings.",
    request: z.object({ level: levelSchema }),
    response: z.object({ level: levelSchema }),
    async handler(ctx, args) {
      const db = ctx.db<typeof schema>();
      const existing = await db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.id, 1));
      if (existing[0]) {
        await db
          .update(schema.settings)
          .set({ level: args.level })
          .where(eq(schema.settings.id, 1));
      } else {
        await db.insert(schema.settings).values({
          id: 1,
          level: args.level,
          interests: JSON.stringify([
            "social housing",
            "artificial intelligence",
            "automation",
            "Seoul",
          ]),
        });
      }
      ctx.invalidateQueries();
      return { level: args.level };
    },
  }),

  getTodayStatus: defineAction({
    description:
      "Reports today's date, the date and number of today's puzzle (or the latest puzzle when today's is late), and whether that puzzle is finished.",
    request: z.object({}),
    response: todayStatusResponse,
    async handler(ctx): Promise<z.infer<typeof todayStatusResponse>> {
      const db = ctx.db<typeof schema>();
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const puzzleRows = await db
        .select()
        .from(schema.puzzles)
        .orderBy(asc(schema.puzzles.date), asc(schema.puzzles.no));
      const todays = puzzleRows.find((p) => p.date === today);
      const latest = puzzleRows[puzzleRows.length - 1];
      const target = todays ?? latest;
      if (!target) {
        return {
          date: today,
          puzzle_date: null,
          puzzle_no: null,
          finished: false,
          late: false,
        };
      }
      const progressRows = await db
        .select()
        .from(schema.progress)
        .where(eq(schema.progress.puzzleId, target.id));
      return {
        date: today,
        puzzle_date: target.date,
        puzzle_no: target.no,
        finished: progressRows[0]?.solvedAt != null,
        late: !todays,
      };
    },
  }),

  addPuzzle: defineAction({
    description:
      "Adds a new daily crossword puzzle (date, number, theme line, level, word list) to the archive without deleting or overwriting existing puzzles or saved progress.",
    request: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      no: z.number().int().positive(),
      theme_line: z.string().min(1),
      level: levelSchema,
      words: z.array(wordSchema).min(1),
    }),
    response: addPuzzleResponse,
    async handler(ctx, args): Promise<z.infer<typeof addPuzzleResponse>> {
      const db = ctx.db<typeof schema>();
      const gridError = validateGrid(args.words);
      if (gridError) {
        return { ok: false, id: null, message: gridError };
      }
      const existing = await db.select().from(schema.puzzles);
      if (existing.some((p) => p.date === args.date)) {
        return {
          ok: false,
          id: null,
          message: `A puzzle already exists for ${args.date}; nothing was overwritten.`,
        };
      }
      if (existing.some((p) => p.no === args.no)) {
        return {
          ok: false,
          id: null,
          message: `Puzzle No. ${args.no} already exists; nothing was overwritten.`,
        };
      }
      const inserted = await db
        .insert(schema.puzzles)
        .values({
          date: args.date,
          no: args.no,
          themeLine: args.theme_line,
          level: args.level,
          words: JSON.stringify(args.words),
        })
        .returning({ id: schema.puzzles.id });
      const row = inserted[0];
      if (!row) {
        return { ok: false, id: null, message: "Insert returned no row." };
      }
      ctx.invalidateQueries();
      return {
        ok: true,
        id: row.id,
        message: `Added puzzle No. ${args.no} for ${args.date}.`,
      };
    },
  }),
} satisfies ActionsModule;
