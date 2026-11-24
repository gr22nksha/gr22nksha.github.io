import { defineAction, z, type ActionsModule } from "@hatch/space-sdk";
import { desc, eq } from "drizzle-orm";
import * as schema from "./schema";

const wordSchema = z.object({
  w: z.string().min(1),
  r: z.number().int().min(0).max(14),
  c: z.number().int().min(0).max(14),
  d: z.enum(["A", "D"]),
  clue: z.string(),
});

const puzzleSchema = z.object({
  id: z.number(),
  date: z.string(),
  no: z.number(),
  theme_line: z.string(),
  level: z.string(),
  words: z.array(wordSchema),
});

const progressSchema = z.object({
  puzzle_id: z.number(),
  values: z.array(z.string()),
  locked: z.array(z.boolean()),
  revealed: z.array(z.boolean()),
  started_at: z.string().nullable(),
  solved_at: z.string().nullable(),
  reveals: z.number(),
});

const stateResponse = z.object({
  puzzles: z.array(puzzleSchema),
  progress: z.array(progressSchema),
  settings: z.object({
    level: z.string(),
    interests: z.array(z.string()),
  }),
});

type StateResponse = z.infer<typeof stateResponse>;

function parseWords(raw: string) {
  try {
    const arr = JSON.parse(raw) as unknown;
    return z.array(wordSchema).parse(arr);
  } catch {
    return [];
  }
}

function parseStrArr(raw: string, len: number, fallback: string): string[] {
  try {
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr) && arr.length === len) return arr.map((x) => String(x ?? ""));
  } catch { /* fall through */ }
  return Array.from({ length: len }, () => fallback);
}
function parseBoolArr(raw: string, len: number): boolean[] {
  try {
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr) && arr.length === len) return arr.map((x) => x === true);
  } catch { /* fall through */ }
  return Array.from({ length: len }, () => false);
}

export const Actions = {
  getState: defineAction({
    description: "모든 퍼즐, 퍼즐별 진행 상황, 설정을 불러옵니다.",
    request: z.object({}),
    response: stateResponse,
    async handler(ctx): Promise<StateResponse> {
      const db = ctx.db<typeof schema>();
      const puzzleRows = await db.select().from(schema.puzzles).orderBy(desc(schema.puzzles.date));
      const progressRows = await db.select().from(schema.progress);
      const settingRows = await db.select().from(schema.settings).limit(1);
      const s = settingRows[0];
      let interests: string[] = [];
      if (s) {
        try { interests = z.array(z.string()).parse(JSON.parse(s.interests)); } catch { interests = []; }
      }
      return {
        puzzles: puzzleRows.map((p) => ({
          id: p.id, date: p.date, no: p.no, theme_line: p.themeLine, level: p.level,
          words: parseWords(p.words),
        })),
        progress: progressRows.map((pr) => ({
          puzzle_id: pr.puzzleId,
          values: parseStrArr(pr.values, 225, ""),
          locked: parseBoolArr(pr.locked, 225),
          revealed: parseBoolArr(pr.revealed, 225),
          started_at: pr.startedAt ? pr.startedAt.toISOString() : null,
          solved_at: pr.solvedAt ? pr.solvedAt.toISOString() : null,
          reveals: pr.reveals,
        })),
        settings: { level: s?.level ?? "보통", interests },
      };
    },
  }),

  saveProgress: defineAction({
    description: "한 퍼즐의 진행 상황(입력값, 잠금, 공개 여부)을 저장합니다.",
    request: z.object({
      puzzle_id: z.number().int(),
      values: z.array(z.string()).length(225),
      locked: z.array(z.boolean()).length(225),
      revealed: z.array(z.boolean()).length(225),
      reveals: z.number().int().min(0),
      solved: z.boolean(),
    }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const existing = await db.select().from(schema.progress).where(eq(schema.progress.puzzleId, args.puzzle_id)).limit(1);
      const now = new Date();
      const solvedAt = args.solved ? (existing[0]?.solvedAt ?? now) : null;
      const valuesJson = JSON.stringify(args.values);
      const lockedJson = JSON.stringify(args.locked);
      const revealedJson = JSON.stringify(args.revealed);
      if (existing[0]) {
        await db.update(schema.progress).set({
          values: valuesJson, locked: lockedJson, revealed: revealedJson,
          reveals: args.reveals, solvedAt,
        }).where(eq(schema.progress.puzzleId, args.puzzle_id));
      } else {
        await db.insert(schema.progress).values({
          puzzleId: args.puzzle_id, values: valuesJson, locked: lockedJson,
          revealed: revealedJson, reveals: args.reveals, solvedAt, startedAt: now,
        });
      }
      return { ok: true as const };
    },
  }),

  setLevel: defineAction({
    description: "난이도 설정을 저장합니다. 다음 퍼즐 생성에 쓰입니다.",
    request: z.object({ level: z.enum(["쉬움", "보통", "어려움"]) }),
    response: z.object({ ok: z.literal(true) }),
    async handler(ctx, args): Promise<{ ok: true }> {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.settings).limit(1);
      if (rows[0]) {
        await db.update(schema.settings).set({ level: args.level }).where(eq(schema.settings.id, rows[0].id));
      } else {
        await db.insert(schema.settings).values({ id: 1, level: args.level, interests: JSON.stringify(["사회주택", "통합돌봄", "에너지 복지", "자동화", "서울"]) });
      }
      ctx.invalidateQueries();
      return { ok: true as const };
    },
  }),

  getTodayStatus: defineAction({
    description: "오늘 퍼즐의 날짜와 완료 여부를 알려줍니다.",
    request: z.object({}),
    response: z.object({
      date: z.string().nullable(),
      no: z.number().nullable(),
      finished: z.boolean(),
      exists: z.boolean(),
    }),
    async handler(ctx) {
      const db = ctx.db<typeof schema>();
      const rows = await db.select().from(schema.puzzles).orderBy(desc(schema.puzzles.date)).limit(1);
      const latest = rows[0];
      if (!latest) return { date: null, no: null, finished: false, exists: false };
      const pr = await db.select().from(schema.progress).where(eq(schema.progress.puzzleId, latest.id)).limit(1);
      return {
        date: latest.date,
        no: latest.no,
        finished: pr[0]?.solvedAt != null,
        exists: true,
      };
    },
  }),

  addPuzzle: defineAction({
    description: "새 퍼즐을 아카이브에 추가합니다. 기존 퍼즐과 진행 상황은 건드리지 않습니다.",
    request: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      no: z.number().int().positive(),
      theme_line: z.string().min(1),
      level: z.string().default("보통"),
      words: z.array(wordSchema).min(1),
    }),
    response: z.object({ ok: z.literal(true), added: z.boolean(), id: z.number().nullable() }),
    async handler(ctx, args): Promise<{ ok: true; added: boolean; id: number | null }> {
      const db = ctx.db<typeof schema>();
      const existing = await db.select().from(schema.puzzles).where(eq(schema.puzzles.date, args.date)).limit(1);
      if (existing[0]) return { ok: true as const, added: false, id: existing[0].id };
      const inserted = await db.insert(schema.puzzles).values({
        date: args.date, no: args.no, themeLine: args.theme_line, level: args.level,
        words: JSON.stringify(args.words),
      }).returning({ id: schema.puzzles.id });
      ctx.invalidateQueries();
      return { ok: true as const, added: true, id: inserted[0]?.id ?? null };
    },
  }),
} satisfies ActionsModule;
