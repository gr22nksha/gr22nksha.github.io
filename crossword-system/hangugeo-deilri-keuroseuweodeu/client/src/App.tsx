import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { api, type ApiResponse } from "./api";

const SIZE = 15;
const TOTAL = SIZE * SIZE;
const RED = "#c8102e";
const HANGUL = /[가-힣]/;

type Word = ApiResponse<typeof api, "getState">["puzzles"][number]["words"][number];
type Puzzle = ApiResponse<typeof api, "getState">["puzzles"][number];
type Dir = "A" | "D";

interface EnrichedWord extends Word {
  cells: number[];
  num: number;
  key: string;
}

function buildGrid(puzzle: Puzzle) {
  const answers: (string | null)[] = Array.from({ length: TOTAL }, () => null);
  for (const w of puzzle.words) {
    const chars = [...w.w];
    chars.forEach((ch, i) => {
      const r = w.d === "A" ? w.r : w.r + i;
      const c = w.d === "A" ? w.c + i : w.c;
      answers[r * SIZE + c] = ch;
    });
  }
  const isLetter = answers.map((a) => a !== null);
  const numbers = new Array<number>(TOTAL).fill(0);
  let next = 1;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const idx = r * SIZE + c;
      if (!isLetter[idx]) continue;
      const leftBlock = c === 0 || !isLetter[idx - 1];
      const rightLetter = c + 1 < SIZE && isLetter[idx + 1] === true;
      const upBlock = r === 0 || !isLetter[idx - SIZE];
      const downLetter = r + 1 < SIZE && isLetter[idx + SIZE] === true;
      if ((leftBlock && rightLetter) || (upBlock && downLetter)) {
        numbers[idx] = next++;
      }
    }
  }
  const words: EnrichedWord[] = puzzle.words.map((w) => {
    const cells = [...w.w].map((_, i) => {
      const r = w.d === "A" ? w.r : w.r + i;
      const c = w.d === "A" ? w.c + i : w.c;
      return r * SIZE + c;
    });
    const start = cells[0] ?? 0;
    return { ...w, cells, num: numbers[start] ?? 0, key: `${w.d}-${w.r}-${w.c}` };
  });
  const letterCount = isLetter.filter(Boolean).length;
  return { answers, isLetter, numbers, words, letterCount };
}

function formatKoreanDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const weekdays = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${weekdays[d.getDay()] ?? ""}`;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const emptyValues = () => Array.from({ length: TOTAL }, () => "");
const emptyBools = () => Array.from({ length: TOTAL }, () => false);

export function App() {
  const queryClient = useQueryClient();
  const state = useQuery({ queryKey: ["state"], queryFn: () => api.getState({}) });

  const [openId, setOpenId] = useState<number | null>(null);
  const [values, setValues] = useState<string[]>(emptyValues);
  const [locked, setLocked] = useState<boolean[]>(emptyBools);
  const [revealed, setRevealed] = useState<boolean[]>(emptyBools);
  const [reveals, setReveals] = useState(0);
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [selIdx, setSelIdx] = useState<number>(0);
  const [selDir, setSelDir] = useState<Dir>("A");
  const [message, setMessage] = useState<string>("");
  const [confirmMode, setConfirmMode] = useState<null | "all" | "clear">(null);
  // Text of the visible entry field. It always holds the selected word's
  // letters and the keyboard composes inside it natively — the app never
  // clears or rewrites the field while it is focused; the grid simply
  // mirrors the completed syllables. (The previous design typed into a
  // tiny transparent input and hand-managed composition events; on real
  // phone keyboards, Android in particular, compositionend often arrives
  // with empty data while the last syllable is still being withheld from
  // compositionupdate, so every syllable was silently dropped and no
  // letter ever landed in the grid.)
  const [entryText, setEntryText] = useState("");
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadedForRef = useRef<number | null>(null);
  const valuesRef = useRef<string[]>(emptyValues());
  const syncedEntryRef = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const puzzles = state.data?.puzzles ?? [];
  const puzzle = puzzles.find((p) => p.id === openId) ?? puzzles[0] ?? null;

  const grid = useMemo(() => (puzzle ? buildGrid(puzzle) : null), [puzzle]);

  // Open the newest puzzle by default
  useEffect(() => {
    if (openId === null && puzzles.length > 0) {
      setOpenId(puzzles[0]?.id ?? null);
    }
  }, [openId, puzzles]);

  // Load saved progress when the open puzzle changes
  useEffect(() => {
    if (!puzzle || !grid || !state.data) return;
    if (loadedForRef.current === puzzle.id) return;
    loadedForRef.current = puzzle.id;
    setLoadedId(puzzle.id);
    const pr = state.data.progress.find((x) => x.puzzle_id === puzzle.id);
    if (pr) {
      setValues([...pr.values]);
      setLocked([...pr.locked]);
      setRevealed([...pr.revealed]);
      setReveals(pr.reveals);
    } else {
      setValues(emptyValues());
      setLocked(emptyBools());
      setRevealed(emptyBools());
      setReveals(0);
    }
    setWrong(new Set());
    setMessage("");
    setConfirmMode(null);
    const firstAcross = grid.words.filter((w) => w.d === "A").sort((a, b) => a.num - b.num)[0];
    const first = firstAcross ?? grid.words[0];
    if (first) {
      setSelIdx(first.cells[0] ?? 0);
      setSelDir(first.d);
    }
  }, [puzzle, grid, state.data]);

  // Always-current mirror of the grid values, for effects that must read
  // the latest committed letters without subscribing to every keystroke.
  useEffect(() => {
    valuesRef.current = values;
  });

  const saveMut = useMutation({
    mutationFn: async (args: Parameters<typeof api.saveProgress>[0]) => api.saveProgress(args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["state"] }),
  });

  const solved = useMemo(() => {
    if (!grid) return false;
    return grid.answers.every((a, i) => a === null || values[i] === a);
  }, [grid, values]);

  // Persist progress on every change (debounced)
  useEffect(() => {
    if (!puzzle || loadedForRef.current !== puzzle.id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveMut.mutate({
        puzzle_id: puzzle.id,
        values, locked, revealed, reveals, solved,
      });
    }, 350);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, locked, revealed, reveals, solved, puzzle]);

  const wordAt = (idx: number, dir: Dir): EnrichedWord | undefined =>
    grid?.words.find((w) => w.d === dir && w.cells.includes(idx));

  const currentWord = grid ? (wordAt(selIdx, selDir) ?? wordAt(selIdx, selDir === "A" ? "D" : "A")) : undefined;
  const effectiveDir: Dir = currentWord?.d ?? selDir;
  const currentWordKey = currentWord?.key ?? null;

  // Load the entry field with the newly selected word's letters. Runs once
  // per (puzzle, word) — guarded by syncedEntryRef — and only after that
  // puzzle's saved progress is in, so typing (which changes values on every
  // keystroke) never triggers a reload that would fight the keyboard.
  useEffect(() => {
    if (!puzzle || !grid || loadedId !== puzzle.id || !currentWordKey) return;
    const syncKey = `${puzzle.id}:${currentWordKey}`;
    if (syncedEntryRef.current === syncKey) return;
    syncedEntryRef.current = syncKey;
    const w = grid.words.find((x) => x.key === currentWordKey);
    if (!w) return;
    const vals = valuesRef.current;
    setEntryText(w.cells.map((i) => vals[i] ?? "").join(""));
  }, [puzzle, grid, loadedId, currentWordKey]);

  const filledCount = grid ? grid.answers.filter((a, i) => a !== null && (values[i] ?? "") !== "").length : 0;
  const acrossTotal = grid?.words.filter((w) => w.d === "A").length ?? 0;
  const downTotal = grid?.words.filter((w) => w.d === "D").length ?? 0;

  const wordSolved = (w: EnrichedWord) =>
    grid != null && w.cells.every((i) => values[i] === grid.answers[i]);

  const focusInput = () => {
    inputRef.current?.focus({ preventScroll: true });
  };

  // Place the entry field's caret once React has committed the (possibly
  // reloaded) field text for the newly selected word.
  const applyCaretSoon = (pos: number) => {
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      const p = Math.max(0, Math.min(pos, el.value.length));
      try { el.setSelectionRange(p, p); } catch { /* caret is best-effort */ }
    });
  };

  const selectCell = (idx: number, keepDir = true) => {
    if (!grid || !grid.isLetter[idx]) return;
    if (idx === selIdx) {
      toggleDir();
      const other: Dir = effectiveDir === "A" ? "D" : "A";
      const w = wordAt(idx, other) ?? wordAt(idx, effectiveDir);
      if (w) applyCaretSoon(w.cells.indexOf(idx));
      return;
    }
    let dir = selDir;
    if (!keepDir || !wordAt(idx, dir)) {
      dir = wordAt(idx, "A") ? "A" : "D";
    }
    setSelIdx(idx);
    setSelDir(dir);
    const w = wordAt(idx, dir);
    if (w) applyCaretSoon(w.cells.indexOf(idx));
  };

  const toggleDir = () => {
    const other: Dir = effectiveDir === "A" ? "D" : "A";
    if (wordAt(selIdx, other)) setSelDir(other);
  };

  const selectWord = (w: EnrichedWord) => {
    const firstEmpty = w.cells.find((i) => (values[i] ?? "") === "" && !locked[i]);
    const target = firstEmpty ?? w.cells[0] ?? 0;
    setSelIdx(target);
    setSelDir(w.d);
    focusInput();
    applyCaretSoon(w.cells.indexOf(target));
  };

  // Mirror the entry field's text into the selected word's cells. The text
  // is mapped position by position: syllable i goes to cell i, locked cells
  // keep their (correct) letter, and a syllable still being composed — a
  // trailing jamo that has not become a syllable yet — simply leaves its
  // cell empty until the next change completes it. Because this only reads
  // the field's text and never writes it back, the keyboard's composition
  // is never disturbed.
  const distributeEntry = (raw: string, caret: number | null) => {
    if (!grid || !currentWord || solved) return;
    const syllables = [...raw].filter((ch) => HANGUL.test(ch));
    const nv = [...values];
    const changed: number[] = [];
    currentWord.cells.forEach((cell, i) => {
      if (locked[cell]) return;
      const next = syllables[i] ?? "";
      if ((nv[cell] ?? "") !== next) {
        nv[cell] = next;
        changed.push(cell);
      }
    });
    if (changed.length > 0) {
      setValues(nv);
      setWrong((prev) => {
        const s = new Set(prev);
        changed.forEach((c) => s.delete(c));
        return s;
      });
      // Auto solved check when the last empty square is filled
      const nowFilled = grid.answers.every((a, i) => a === null || (nv[i] ?? "") !== "");
      if (nowFilled) {
        const allRight = grid.answers.every((a, i) => a === null || nv[i] === a);
        if (allRight) {
          setLocked(grid.isLetter.map((isL, i) => (isL ? true : (locked[i] ?? false))));
          setMessage("모든 칸이 정답입니다.");
        }
      }
    }
    // Keep the highlighted cell at the caret's syllable position.
    if (caret !== null) {
      const before = [...raw.slice(0, caret)].filter((ch) => HANGUL.test(ch)).length;
      const pos = Math.max(0, Math.min(before, currentWord.cells.length - 1));
      const cell = currentWord.cells[pos];
      if (cell !== undefined && cell !== selIdx) setSelIdx(cell);
    }
  };

  const onEntryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setEntryText(v);
    distributeEntry(v, e.target.selectionStart);
  };

  const onEntryKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); jumpNextClue(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveArrow(-1, 0); }
    else if (e.key === "ArrowDown") { e.preventDefault(); moveArrow(1, 0); }
    // ArrowLeft/ArrowRight move the caret natively; onEntrySelect then
    // syncs the highlighted cell to the caret.
  };

  const onEntrySelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    if (!currentWord) return;
    const caret = e.currentTarget.selectionStart;
    if (caret === null) return;
    const before = [...entryText.slice(0, caret)].filter((ch) => HANGUL.test(ch)).length;
    const pos = Math.max(0, Math.min(before, currentWord.cells.length - 1));
    const cell = currentWord.cells[pos];
    if (cell !== undefined && cell !== selIdx) setSelIdx(cell);
  };

  const moveArrow = (dr: number, dc: number) => {
    if (!grid) return;
    let r = Math.floor(selIdx / SIZE) + dr;
    let c = (selIdx % SIZE) + dc;
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
      const idx = r * SIZE + c;
      if (grid.isLetter[idx]) {
        const dir: Dir = dc !== 0 ? "A" : "D";
        setSelIdx(idx);
        if (wordAt(idx, dir)) setSelDir(dir);
        return;
      }
      r += dr;
      c += dc;
    }
  };

  const jumpNextClue = () => {
    if (!grid) return;
    const ordered = [...grid.words].sort((a, b) => a.num - b.num || (a.d === "A" ? -1 : 1));
    const curKey = currentWord?.key;
    const startPos = ordered.findIndex((w) => w.key === curKey);
    for (let step = 1; step <= ordered.length; step++) {
      const w = ordered[(startPos + step) % ordered.length];
      if (!w) continue;
      const empty = w.cells.find((i) => (values[i] ?? "") === "");
      if (empty !== undefined) {
        setSelIdx(empty);
        setSelDir(w.d);
        applyCaretSoon(w.cells.indexOf(empty));
        return;
      }
    }
  };

  const runCheck = () => {
    if (!grid) return;
    let correct = 0, wrongCount = 0, empty = 0;
    const newLocked = [...locked];
    const newWrong = new Set<number>();
    grid.answers.forEach((a, i) => {
      if (a === null) return;
      const v = values[i] ?? "";
      if (v === "") empty++;
      else if (v === a) { correct++; newLocked[i] = true; }
      else { wrongCount++; newWrong.add(i); }
    });
    setLocked(newLocked);
    setWrong(newWrong);
    if (wrongCount === 0 && empty === 0) {
      setMessage(`검사 완료 — 모두 맞았어요! 맞은 칸 ${correct}개입니다.`);
    } else {
      setMessage(`검사 결과 — 맞은 칸 ${correct}개, 틀린 칸 ${wrongCount}개, 빈 칸 ${empty}개입니다.`);
    }
  };

  const revealLetter = () => {
    if (!grid || !currentWord) return;
    const a = grid.answers[selIdx];
    if (a === null || a === undefined) return;
    const nv = [...values]; nv[selIdx] = a;
    const nl = [...locked]; nl[selIdx] = true;
    const nr = [...revealed]; nr[selIdx] = true;
    setValues(nv); setLocked(nl); setRevealed(nr);
    setReveals((n) => n + 1);
    setEntryText(currentWord.cells.map((i) => nv[i] ?? "").join(""));
    setMessage(`${currentWord.num}번 ${currentWord.d === "A" ? "가로" : "세로"} "${currentWord.clue}" — 글자 하나를 공개했어요.`);
  };

  const revealWord = () => {
    if (!grid || !currentWord) return;
    const nv = [...values]; const nl = [...locked]; const nr = [...revealed];
    currentWord.cells.forEach((i) => {
      const a = grid.answers[i];
      if (a) { nv[i] = a; nl[i] = true; nr[i] = true; }
    });
    setValues(nv); setLocked(nl); setRevealed(nr);
    setReveals((n) => n + 1);
    setEntryText(currentWord.cells.map((i) => nv[i] ?? "").join(""));
    setMessage(`${currentWord.num}번 ${currentWord.d === "A" ? "가로" : "세로"} "${currentWord.clue}" — 단어 전체를 공개했어요.`);
  };

  const revealAll = () => {
    if (!grid) return;
    const nv = [...values]; const nl = [...locked]; const nr = [...revealed];
    grid.answers.forEach((a, i) => { if (a) { nv[i] = a; nl[i] = true; nr[i] = true; } });
    setValues(nv); setLocked(nl); setRevealed(nr);
    setReveals((n) => n + 1);
    setConfirmMode(null);
    if (currentWord) setEntryText(currentWord.cells.map((i) => nv[i] ?? "").join(""));
    setMessage("퍼즐 전체의 정답을 공개했어요.");
  };

  const clearAll = () => {
    const nv = emptyValues(); const nl = emptyBools(); const nr = emptyBools();
    setValues(nv); setLocked(nl); setRevealed(nr);
    setWrong(new Set());
    setConfirmMode(null);
    setEntryText("");
    setMessage("입력한 내용을 모두 지웠어요.");
  };

  const levelMut = useMutation({
    mutationFn: async (level: "쉬움" | "보통" | "어려움") => api.setLevel({ level }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["state"] }),
  });

  // Yesterday's puzzle relative to the open puzzle
  const yesterdayPuzzle = useMemo(() => {
    if (!puzzle) return null;
    const yDate = shiftDate(puzzle.date, -1);
    return puzzles.find((p) => p.date === yDate) ?? null;
  }, [puzzle, puzzles]);
  const yesterdaySolved = yesterdayPuzzle
    ? (state.data?.progress.find((x) => x.puzzle_id === yesterdayPuzzle.id)?.solved_at ?? null) !== null
    : false;
  const yesterdayGrid = useMemo(() => (yesterdayPuzzle ? buildGrid(yesterdayPuzzle) : null), [yesterdayPuzzle]);

  if (state.isPending) {
    return (
      <div className="paper-texture min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="font-sans-kr text-sm text-[#55534e]">퍼즐을 불러오는 중입니다…</p>
        </main>
      </div>
    );
  }

  if (state.error || !puzzle || !grid) {
    return (
      <div className="paper-texture min-h-screen">
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="font-serif-kr text-lg">아직 퍼즐이 없습니다.</p>
          <p className="font-sans-kr mt-2 text-sm text-[#55534e]">새 퍼즐이 도착하면 여기에 표시됩니다.</p>
          <button
            type="button"
            onClick={() => state.refetch()}
            className="font-sans-kr mt-4 border border-black px-4 py-2 text-sm"
          >
            다시 시도
          </button>
        </main>
      </div>
    );
  }

  const level = state.data?.settings.level ?? puzzle.level ?? "보통";
  const archive = puzzles.filter((p) => p.id !== puzzle.id);

  return (
    <div className="paper-texture min-h-screen text-[#111]">
      <SafeAreaTopScrim backgroundColor="#ffffff" />
      <main className="mx-auto max-w-5xl px-3 pb-10 sm:px-5">
        {/* Masthead */}
        <header className="double-rule mt-3 border-b border-black pb-2 pt-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-sans-kr flex items-center gap-2 text-[13px] font-bold tracking-wide">
              <span aria-hidden="true" style={{ color: RED }}>◆</span>
              데일리 한국어 크로스워드
            </p>
            <p className="font-latin text-right text-[12px] text-[#333]">
              {formatKoreanDate(puzzle.date)} · No. {String(puzzle.no).padStart(3, "0")}
            </p>
          </div>
        </header>

        <h1 className="font-serif-kr mt-4 text-[26px] font-black leading-snug sm:text-[34px]">
          {puzzle.theme_line}
        </h1>
        <p className="font-serif-kr mt-1 text-[14px] italic text-[#444]">
          칸을 누른 뒤, 아래 입력칸에 답을 쓰세요.
        </p>

        {/* Toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-[#d9d6d0] py-2">
          <button type="button" onClick={runCheck} className="font-sans-kr px-4 py-2 text-sm font-bold text-white" style={{ background: RED }}>
            검사하기
          </button>
          <button type="button" onClick={revealLetter} className="font-sans-kr border border-black px-3 py-2 text-sm">글자 보기</button>
          <button type="button" onClick={revealWord} className="font-sans-kr border border-black px-3 py-2 text-sm">단어 보기</button>
          <button type="button" onClick={() => setConfirmMode(confirmMode === "all" ? null : "all")} className="font-sans-kr border border-black px-3 py-2 text-sm">전체 보기</button>
          <button type="button" onClick={() => setConfirmMode(confirmMode === "clear" ? null : "clear")} className="font-sans-kr border border-black px-3 py-2 text-sm">지우기</button>
          <div className="ml-auto flex items-center gap-1" role="group" aria-label="난이도">
            {(["쉬움", "보통", "어려움"] as const).map((lv, i) => (
              <span key={lv} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden="true" className="text-[#999]">·</span>}
                <button
                  type="button"
                  aria-pressed={level === lv}
                  onClick={() => levelMut.mutate(lv)}
                  className="font-sans-kr px-1 py-2 text-sm"
                  style={level === lv ? { fontWeight: 800, color: RED } : { color: "#55534e" }}
                >
                  {lv}
                </button>
              </span>
            ))}
          </div>
        </div>

        {confirmMode && (
          <div className="font-sans-kr flex flex-wrap items-center gap-3 border-b border-[#d9d6d0] bg-[#fdf6ec] px-3 py-2 text-sm" role="alert">
            <span>{confirmMode === "all" ? "퍼즐 전체의 정답을 공개할까요?" : "입력한 내용을 모두 지울까요?"}</span>
            <button
              type="button"
              onClick={confirmMode === "all" ? revealAll : clearAll}
              className="px-3 py-1 font-bold text-white"
              style={{ background: RED }}
            >
              {confirmMode === "all" ? "전체 보기 확인" : "지우기 확인"}
            </button>
            <button type="button" onClick={() => setConfirmMode(null)} className="border border-black px-3 py-1">취소</button>
          </div>
        )}

        {solved && (
          <div className="mt-4 border border-black bg-[#fdf6ec] px-4 py-3">
            <p className="font-serif-kr text-xl font-black">완성했어요. 잘 푸셨어요!</p>
            <p className="font-serif-kr mt-1 text-sm">
              {reveals > 0
                ? `공개 기능을 ${reveals}번 도움받아 끝까지 채웠습니다. 내일 새 퍼즐에서 또 만나요.`
                : "도움 없이 끝까지 채웠습니다. 내일 새 퍼즐에서 또 만나요."}
            </p>
          </div>
        )}

        {/* Status + progress */}
        <p className="font-sans-kr mt-3 text-[13px] text-[#333]" aria-live="polite">
          {message || `${grid.letterCount}칸 중 ${filledCount}칸 입력 · 가로 ${acrossTotal}개, 세로 ${downTotal}개`}
        </p>
        <div className="mt-1 h-[4px] w-full bg-[#e8e4dc]" role="progressbar" aria-valuemin={0} aria-valuemax={grid.letterCount} aria-valuenow={filledCount} aria-label="진행률">
          <div className="h-full transition-all" style={{ width: `${grid.letterCount ? (filledCount / grid.letterCount) * 100 : 0}%`, background: RED }} />
        </div>

        {/* Clue bar */}
        <button
          type="button"
          onClick={() => { toggleDir(); focusInput(); }}
          aria-label="현재 단서 — 누르면 가로와 세로가 바뀝니다"
          className="mt-3 flex w-full items-stretch border border-black text-left"
          style={{ borderLeft: `4px solid ${RED}` }}
        >
          <span className="font-sans-kr flex items-center px-3 py-2 text-sm font-black" style={{ color: RED }}>
            {effectiveDir === "A" ? "가로" : "세로"} {currentWord?.num ?? ""}
          </span>
          <span className="font-serif-kr flex items-center px-2 py-2 text-[15px]">
            {currentWord?.clue ?? ""}
            {currentWord && <span className="font-sans-kr ml-2 text-[12px] text-[#55534e]">({[...currentWord.w].length}글자)</span>}
          </span>
        </button>

        {/* Entry field — the keyboard lives here. It is a plain visible
            text field holding the selected word's letters, so any phone
            keyboard composes Hangul inside it exactly like in any other
            app; the grid below mirrors what is typed. */}
        <div className="mt-3">
          <label htmlFor="cw-entry" className="font-sans-kr text-[12px] font-bold text-[#55534e]">
            답 입력{currentWord ? ` · ${effectiveDir === "A" ? "가로" : "세로"} ${currentWord.num}번 (${[...currentWord.w].length}글자)` : ""}
          </label>
          <input
            id="cw-entry"
            ref={inputRef}
            type="text"
            lang="ko"
            aria-label="한글 입력"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            value={entryText}
            disabled={solved}
            onChange={onEntryChange}
            onKeyDown={onEntryKeyDown}
            onSelect={onEntrySelect}
            placeholder="여기에 답을 입력하세요"
            className="font-serif-kr mt-1 w-full border border-black bg-white px-3 py-3 text-[18px] tracking-[0.2em] outline-none"
          />
        </div>

        {/* Board */}
        <div className="relative mx-auto mt-3 w-full max-w-[560px]">
          <div
            role="grid"
            aria-label="크로스워드 판"
            className="grid border-2 border-black outline-none"
            style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}
          >
            {Array.from({ length: TOTAL }, (_, idx) => {
              const isLetterCell = grid.isLetter[idx] === true;
              if (!isLetterCell) {
                return <div key={idx} className="aspect-square bg-black" aria-hidden="true" />;
              }
              const inWord = currentWord?.cells.includes(idx) ?? false;
              const isSel = idx === selIdx;
              const num = grid.numbers[idx] ?? 0;
              const v = values[idx] ?? "";
              const isWrong = wrong.has(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  role="gridcell"
                  aria-label={`${Math.floor(idx / SIZE) + 1}행 ${idx % SIZE + 1}열${num ? `, ${num}번` : ""}${v ? `, ${v}` : ", 빈 칸"}`}
                  onClick={() => { selectCell(idx); focusInput(); }}
                  className="relative aspect-square border border-[#b9b4a8] p-0"
                  style={{
                    background: isSel ? "#f9d976" : inWord ? "#fdeec9" : "#ffffff",
                    minHeight: 0,
                  }}
                >
                  {num > 0 && (
                    <span className="font-latin absolute left-[2px] top-[1px] text-[9px] leading-none text-[#333]">{num}</span>
                  )}
                  <span
                    className="font-sans-kr flex h-full items-center justify-center font-bold"
                    style={{ fontSize: "clamp(16px, 4.6vw, 26px)", color: isWrong ? RED : "#111" }}
                  >
                    {v}
                  </span>
                  {locked[idx] && !isWrong && (
                    <span className="absolute bottom-[1px] right-[2px] text-[8px] leading-none text-[#8a8578]" aria-hidden="true">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Clue columns */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {(["A", "D"] as const).map((dir) => (
            <section key={dir} aria-label={dir === "A" ? "가로 단서" : "세로 단서"}>
              <h2 className="font-sans-kr border-b-2 border-black pb-1 text-base font-black">
                {dir === "A" ? "가로" : "세로"}
              </h2>
              <ul className="mt-1">
                {grid.words.filter((w) => w.d === dir).sort((a, b) => a.num - b.num).map((w) => {
                  const isCurrent = currentWord?.key === w.key;
                  const isSolved = wordSolved(w);
                  return (
                    <li key={w.key}>
                      <button
                        type="button"
                        onClick={() => selectWord(w)}
                        className="flex w-full items-baseline gap-2 px-1 py-[6px] text-left"
                        style={isCurrent ? { background: "#fdeec9" } : undefined}
                      >
                        <span className="font-latin w-6 shrink-0 text-sm font-bold">{w.num}</span>
                        <span
                          className="font-serif-kr text-[15px]"
                          style={isSolved ? { textDecoration: "line-through", textDecorationColor: RED } : undefined}
                        >
                          {w.clue}
                          <span className="font-sans-kr ml-1 text-[12px] text-[#55534e]">({[...w.w].length})</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {/* Yesterday's answers */}
        {yesterdayPuzzle && yesterdaySolved && yesterdayGrid && (
          <section aria-label="어제의 정답" className="mt-8 border-t border-black pt-3">
            <h2 className="font-sans-kr text-base font-black">어제의 정답</h2>
            <p className="font-sans-kr mt-1 text-[12px] text-[#55534e]">
              {formatKoreanDate(yesterdayPuzzle.date)} · {yesterdayPuzzle.theme_line}
            </p>
            <div style={{ transform: "rotate(180deg)" }} className="mx-auto mt-3 w-full max-w-[320px]">
              <div className="grid border-2 border-black" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
                {Array.from({ length: TOTAL }, (_, idx) => {
                  const a = yesterdayGrid.answers[idx];
                  if (a === null || a === undefined) return <div key={idx} className="aspect-square bg-black" />;
                  return (
                    <div key={idx} className="relative aspect-square border border-[#b9b4a8] bg-white">
                      <span className="font-sans-kr flex h-full items-center justify-center text-[11px] font-bold">{a}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Archive */}
        <section aria-label="지난 퍼즐" className="mt-8 border-t border-black pt-3">
          <h2 className="font-sans-kr text-base font-black">지난 퍼즐</h2>
          {archive.length === 0 ? (
            <p className="font-serif-kr mt-2 text-sm text-[#55534e]">아직 지난 퍼즐이 없습니다. 내일 새 퍼즐이 도착하면 이곳에 쌓입니다.</p>
          ) : (
            <ul className="mt-1 divide-y divide-[#e5e1d8]">
              {archive.map((p) => {
                const pr = state.data?.progress.find((x) => x.puzzle_id === p.id);
                const pg = buildGrid(p);
                const filledN = pr ? pg.answers.filter((a, i) => a !== null && (pr.values[i] ?? "") !== "").length : 0;
                const statusText = pr?.solved_at ? "완료" : filledN > 0 ? "진행 중" : "시작 전";
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => { loadedForRef.current = null; setOpenId(p.id); window.scrollTo({ top: 0 }); }}
                      className="flex w-full items-baseline justify-between gap-3 py-2 text-left"
                    >
                      <span className="font-serif-kr text-[15px]">
                        <span className="font-latin mr-2 text-[13px] text-[#55534e]">No. {String(p.no).padStart(3, "0")}</span>
                        {p.theme_line}
                      </span>
                      <span className="font-sans-kr shrink-0 text-[12px] text-[#55534e]">
                        {formatKoreanDate(p.date)} · <span style={statusText === "완료" ? { color: RED, fontWeight: 700 } : undefined}>{statusText}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {puzzles.length > 1 && (
            <button
              type="button"
              onClick={() => { loadedForRef.current = null; setOpenId(puzzles[0]?.id ?? null); window.scrollTo({ top: 0 }); }}
              className="font-sans-kr mt-2 text-[13px] underline"
            >
              가장 최근 퍼즐로 돌아가기
            </button>
          )}
        </section>

        <footer className="mt-8 border-t border-[#d9d6d0] pt-3">
          <p className="font-sans-kr text-[12px] text-[#55534e]">
            단서를 누르면 그 단어로 이동합니다. 선택한 칸을 다시 누르면 가로와 세로가 바뀝니다.
          </p>
        </footer>
      </main>
    </div>
  );
}
