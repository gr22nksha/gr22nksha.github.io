import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "./api";

type State = ApiResponse<typeof api, "getState">;
type Puzzle = State["puzzles"][number];
type WordIn = Puzzle["words"][number];
type Dir = "A" | "D";
type Level = "easy" | "medium" | "hard";

type XWord = WordIn & { num: number; cells: number[] };

type Prog = {
  values: string[];
  locked: boolean[];
  revealed: boolean[];
  reveals: number;
  solved: boolean;
};

const SIZE = 15;
const CELLS = SIZE * SIZE;

const SOLVED_BANNER = {
  headline: "Solved. Nice work, chae.",
  body: "Every square is correct, crossings and all.",
};
const REVEALED_BANNER = {
  headline: "Puzzle revealed.",
  body: "The full solution is on the board. Clear it and try once more from memory.",
};

function emptyProg(): Prog {
  return {
    values: Array.from({ length: CELLS }, () => ""),
    locked: Array.from({ length: CELLS }, () => false),
    revealed: Array.from({ length: CELLS }, () => false),
    reveals: 0,
    solved: false,
  };
}

type Model = {
  sol: (string | null)[];
  numbers: Map<number, number>;
  across: XWord[];
  down: XWord[];
  cellA: Map<number, XWord>;
  cellD: Map<number, XWord>;
  letterCells: number[];
  total: number;
};

function buildModel(puzzle: Puzzle): Model {
  const sol: (string | null)[] = Array.from({ length: CELLS }, () => null);
  for (const w of puzzle.words) {
    for (let i = 0; i < w.w.length; i++) {
      const r = w.d === "D" ? w.r + i : w.r;
      const c = w.d === "A" ? w.c + i : w.c;
      sol[r * SIZE + c] = w.w[i] ?? null;
    }
  }
  const isLetter = (r: number, c: number) =>
    r >= 0 && r < SIZE && c >= 0 && c < SIZE && sol[r * SIZE + c] !== null;
  const numbers = new Map<number, number>();
  let next = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!isLetter(r, c)) continue;
      const startsA = !isLetter(r, c - 1) && isLetter(r, c + 1);
      const startsD = !isLetter(r - 1, c) && isLetter(r + 1, c);
      if (startsA || startsD) {
        next += 1;
        numbers.set(r * SIZE + c, next);
      }
    }
  }
  const cellA = new Map<number, XWord>();
  const cellD = new Map<number, XWord>();
  const across: XWord[] = [];
  const down: XWord[] = [];
  for (const w of puzzle.words) {
    const cells: number[] = [];
    for (let i = 0; i < w.w.length; i++) {
      const r = w.d === "D" ? w.r + i : w.r;
      const c = w.d === "A" ? w.c + i : w.c;
      cells.push(r * SIZE + c);
    }
    const xw: XWord = { ...w, num: numbers.get(cells[0] ?? 0) ?? 0, cells };
    if (w.d === "A") {
      across.push(xw);
      for (const i of cells) cellA.set(i, xw);
    } else {
      down.push(xw);
      for (const i of cells) cellD.set(i, xw);
    }
  }
  across.sort((a, b) => a.num - b.num);
  down.sort((a, b) => a.num - b.num);
  const letterCells: number[] = [];
  sol.forEach((ch, i) => {
    if (ch !== null) letterCells.push(i);
  });
  return {
    sol,
    numbers,
    across,
    down,
    cellA,
    cellD,
    letterCells,
    total: letterCells.length,
  };
}

function parseDateParts(dateStr: string): [number, number, number] {
  const [y = 1970, m = 1, d = 1] = dateStr.split("-").map(Number);
  return [y, m, d];
}

function fmtLong(dateStr: string): string {
  const [y, m, d] = parseDateParts(dateStr);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function fmtShort(dateStr: string): string {
  const [y, m, d] = parseDateParts(dateStr);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function shiftDate(dateStr: string, days: number): string {
  const [y, m, d] = parseDateParts(dateStr);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function dirName(d: Dir): string {
  return d === "A" ? "Across" : "Down";
}

export function App() {
  const stateQ = useQuery({
    queryKey: ["crossword-state"],
    queryFn: () => api.getState({}),
  });

  if (stateQ.isPending) {
    return (
      <div className="page">
        <p className="state-msg">Loading the crossword…</p>
      </div>
    );
  }
  if (stateQ.error || !stateQ.data) {
    return (
      <div className="page">
        <div className="state-msg">
          <p>The crossword could not be loaded.</p>
          <button
            type="button"
            className="btn"
            style={{ marginTop: 12 }}
            onClick={() => void stateQ.refetch()}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (stateQ.data.puzzles.length === 0) {
    return (
      <div className="page">
        <p className="state-msg">No puzzles yet. The first one is on its way.</p>
      </div>
    );
  }
  return <PuzzlePage data={stateQ.data} />;
}

function PuzzlePage({ data }: { data: State }) {
  const puzzles = data.puzzles;
  const latest = puzzles[puzzles.length - 1] ?? puzzles[0];
  const [openId, setOpenId] = useState<number>(latest?.id ?? 0);
  const puzzle = puzzles.find((p) => p.id === openId) ?? latest;

  const [progMap, setProgMap] = useState<Record<number, Prog>>(() => {
    const map: Record<number, Prog> = {};
    for (const row of data.progress) {
      map[row.puzzle_id] = {
        values: row.values,
        locked: row.locked,
        revealed: row.revealed,
        reveals: row.reveals,
        solved: row.solved_at != null,
      };
    }
    return map;
  });

  const saveMut = useMutation({
    mutationFn: async (args: {
      puzzle_id: number;
      values: string[];
      locked: boolean[];
      revealed: boolean[];
      reveals: number;
      solved: boolean;
    }) => await api.saveProgress(args),
  });
  const saveRef = useRef(saveMut.mutate);
  saveRef.current = saveMut.mutate;

  const commitFor = (puzzleId: number, next: Prog) => {
    setProgMap((m) => ({ ...m, [puzzleId]: next }));
    saveRef.current({
      puzzle_id: puzzleId,
      values: next.values,
      locked: next.locked,
      revealed: next.revealed,
      reveals: next.reveals,
      solved: next.solved,
    });
  };

  if (!puzzle) return null;
  return (
    <PuzzleView
      key={puzzle.id}
      data={data}
      puzzle={puzzle}
      puzzles={puzzles}
      latest={latest}
      prog={progMap[puzzle.id] ?? emptyProg()}
      progMap={progMap}
      onCommit={(next) => commitFor(puzzle.id, next)}
      onOpen={setOpenId}
    />
  );
}

function PuzzleView({
  data,
  puzzle,
  puzzles,
  latest,
  prog,
  progMap,
  onCommit,
  onOpen,
}: {
  data: State;
  puzzle: Puzzle;
  puzzles: Puzzle[];
  latest: Puzzle | undefined;
  prog: Prog;
  progMap: Record<number, Prog>;
  onCommit: (next: Prog) => void;
  onOpen: (id: number) => void;
}) {
  const model = useMemo(() => buildModel(puzzle), [puzzle]);

  const [level, setLevel] = useState<Level>(data.settings.level);
  const [sel, setSel] = useState<{ idx: number; dir: Dir }>(() => ({
    idx: model.across[0]?.cells[0] ?? model.letterCells[0] ?? 0,
    dir: "A",
  }));
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ headline: string; body: string } | null>(
    prog.solved ? SOLVED_BANNER : null,
  );
  const [confirm, setConfirm] = useState<"reveal" | "clear" | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const selRef = useRef(sel);
  selRef.current = sel;
  const progRef = useRef(prog);
  progRef.current = prog;

  const commit = (next: Prog) => {
    progRef.current = next;
    onCommit(next);
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const levelMut = useMutation({
    mutationFn: async (l: Level) => await api.setLevel({ level: l }),
  });

  // Auto-solved check: runs when the last empty square is filled.
  useEffect(() => {
    if (model.total === 0) return;
    const p = progRef.current;
    if (p.solved) return;
    const filled = model.letterCells.every((i) => (p.values[i] ?? "") !== "");
    if (!filled) return;
    const correct = model.letterCells.every((i) => p.values[i] === model.sol[i]);
    if (correct) {
      setBanner(SOLVED_BANNER);
      setNotice("Puzzle complete.");
      commitRef.current({ ...p, solved: true });
    }
  }, [prog.values, model]);

  const currentWord: XWord | undefined =
    (sel.dir === "A" ? model.cellA.get(sel.idx) : model.cellD.get(sel.idx)) ??
    (sel.dir === "A" ? model.cellD.get(sel.idx) : model.cellA.get(sel.idx));
  const inWordSet = useMemo(
    () => new Set(currentWord?.cells ?? []),
    [currentWord],
  );

  const applySel = (idx: number, dir: Dir, focus = true) => {
    setSel({ idx, dir });
    selRef.current = { idx, dir };
    if (focus) {
      requestAnimationFrame(() => {
        const el = inputRefs.current[idx];
        if (el) {
          el.focus();
          el.select();
        }
      });
    }
  };

  const dirFor = (idx: number, preferred: Dir): Dir => {
    const hasA = model.cellA.has(idx);
    const hasD = model.cellD.has(idx);
    if (preferred === "A") return hasA ? "A" : hasD ? "D" : "A";
    return hasD ? "D" : hasA ? "A" : "D";
  };

  const wordAt = (idx: number, dir: Dir): XWord | undefined =>
    (dir === "A" ? model.cellA.get(idx) : model.cellD.get(idx)) ??
    (dir === "A" ? model.cellD.get(idx) : model.cellA.get(idx));

  const advance = (idx: number) => {
    const w = wordAt(idx, selRef.current.dir);
    if (!w) return;
    const pos = w.cells.indexOf(idx);
    const nextIdx = pos >= 0 ? w.cells[pos + 1] : undefined;
    if (nextIdx !== undefined) applySel(nextIdx, w.d);
  };

  const handleChange = (idx: number, raw: string) => {
    const p = progRef.current;
    if (p.locked[idx]) {
      advance(idx);
      return;
    }
    const ch = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(-1);
    if (!ch) return;
    const values = [...p.values];
    values[idx] = ch;
    setWrong((w) => {
      if (!w.has(idx)) return w;
      const s = new Set(w);
      s.delete(idx);
      return s;
    });
    setBanner(null);
    setNotice(null);
    commit({ ...p, values });
    advance(idx);
  };

  const clearCell = (idx: number) => {
    const p = progRef.current;
    const values = [...p.values];
    values[idx] = "";
    setWrong((w) => {
      if (!w.has(idx)) return w;
      const s = new Set(w);
      s.delete(idx);
      return s;
    });
    setBanner(null);
    setNotice(null);
    commit({ ...p, values });
  };

  const moveBackInWord = (idx: number) => {
    const w = wordAt(idx, selRef.current.dir);
    if (!w) return;
    const pos = w.cells.indexOf(idx);
    const prevIdx = pos > 0 ? w.cells[pos - 1] : undefined;
    if (prevIdx !== undefined) applySel(prevIdx, w.d);
  };

  const moveArrow = (idx: number, dr: number, dc: number) => {
    let r = Math.floor(idx / SIZE) + dr;
    let c = (idx % SIZE) + dc;
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
      const nIdx = r * SIZE + c;
      if (model.sol[nIdx] !== null) {
        const dir =
          dr !== 0
            ? model.cellD.has(nIdx)
              ? "D"
              : "A"
            : model.cellA.has(nIdx)
              ? "A"
              : "D";
        applySel(nIdx, dir);
        return;
      }
      r += dr;
      c += dc;
    }
  };

  const jumpNext = (step: 1 | -1) => {
    const p = progRef.current;
    const ordered = [...model.across, ...model.down];
    if (ordered.length === 0) return;
    const cur = wordAt(selRef.current.idx, selRef.current.dir);
    let start = cur ? ordered.indexOf(cur) : -1;
    if (start < 0) start = step === 1 ? -1 : 0;
    for (let k = 1; k <= ordered.length; k++) {
      const w =
        ordered[(start + step * k + ordered.length * 2) % ordered.length];
      if (!w) continue;
      const emptyIdx = w.cells.find((i) => (p.values[i] ?? "") === "");
      if (emptyIdx !== undefined) {
        applySel(emptyIdx, w.d);
        return;
      }
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number,
  ) => {
    const p = progRef.current;
    switch (e.key) {
      case "Backspace": {
        e.preventDefault();
        if (p.locked[idx]) {
          moveBackInWord(idx);
        } else if ((p.values[idx] ?? "") !== "") {
          clearCell(idx);
        } else {
          moveBackInWord(idx);
        }
        break;
      }
      case "Delete": {
        e.preventDefault();
        if (!p.locked[idx] && (p.values[idx] ?? "") !== "") clearCell(idx);
        break;
      }
      case "ArrowLeft":
        e.preventDefault();
        moveArrow(idx, 0, -1);
        break;
      case "ArrowRight":
        e.preventDefault();
        moveArrow(idx, 0, 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        moveArrow(idx, -1, 0);
        break;
      case "ArrowDown":
        e.preventDefault();
        moveArrow(idx, 1, 0);
        break;
      case "Enter":
        e.preventDefault();
        jumpNext(1);
        break;
      case "Tab":
        e.preventDefault();
        jumpNext(e.shiftKey ? -1 : 1);
        break;
      case " ":
        e.preventDefault();
        break;
      default:
        break;
    }
  };

  const toggleDirection = (idx: number) => {
    const other: Dir = selRef.current.dir === "A" ? "D" : "A";
    const has = other === "A" ? model.cellA.has(idx) : model.cellD.has(idx);
    if (has) {
      applySel(idx, other, false);
      inputRefs.current[idx]?.select();
    }
  };

  const focusWord = (w: XWord) => {
    const p = progRef.current;
    const target = w.cells.find((i) => (p.values[i] ?? "") === "") ?? w.cells[0];
    if (target !== undefined) applySel(target, w.d);
  };

  const checkPuzzle = () => {
    const p = progRef.current;
    const locked = [...p.locked];
    const wrongSet = new Set<number>();
    let correct = 0;
    let wrongCount = 0;
    let empty = 0;
    for (const i of model.letterCells) {
      const v = p.values[i] ?? "";
      if (v === "") {
        empty += 1;
      } else if (v === model.sol[i]) {
        correct += 1;
        locked[i] = true;
      } else {
        wrongCount += 1;
        wrongSet.add(i);
      }
    }
    setWrong(wrongSet);
    if (wrongCount === 0 && empty === 0) {
      setBanner(SOLVED_BANNER);
      setNotice("Puzzle complete.");
      commit({ ...p, locked, solved: true });
    } else {
      setNotice(
        `Check: ${correct} correct · ${wrongCount} wrong (marked red) · ${empty} still empty. Correct squares are now locked.`,
      );
      commit({ ...p, locked });
    }
  };

  const revealLetter = () => {
    const p = progRef.current;
    const idx = selRef.current.idx;
    const ch = model.sol[idx];
    if (ch === null || ch === undefined) return;
    const values = [...p.values];
    const locked = [...p.locked];
    const revealed = [...p.revealed];
    values[idx] = ch;
    locked[idx] = true;
    revealed[idx] = true;
    const w = wordAt(idx, selRef.current.dir);
    commit({ ...p, values, locked, revealed, reveals: p.reveals + 1 });
    if (w) {
      setNotice(`Revealed the letter at ${w.num} ${dirName(w.d)}.`);
    }
    advance(idx);
  };

  const revealWord = () => {
    const p = progRef.current;
    const w = wordAt(selRef.current.idx, selRef.current.dir);
    if (!w) return;
    const values = [...p.values];
    const locked = [...p.locked];
    const revealed = [...p.revealed];
    for (const i of w.cells) {
      const ch = model.sol[i];
      if (ch) {
        values[i] = ch;
        locked[i] = true;
        revealed[i] = true;
      }
    }
    commit({ ...p, values, locked, revealed, reveals: p.reveals + 1 });
    setNotice(`Revealed ${w.num} ${dirName(w.d)}: ${w.w}.`);
  };

  const revealPuzzle = () => {
    const p = progRef.current;
    const values = [...p.values];
    const locked = [...p.locked];
    const revealed = [...p.revealed];
    for (const i of model.letterCells) {
      const ch = model.sol[i];
      if (!ch) continue;
      if (values[i] !== ch) revealed[i] = true;
      values[i] = ch;
      locked[i] = true;
    }
    setWrong(new Set());
    setConfirm(null);
    setBanner(REVEALED_BANNER);
    setNotice(null);
    commit({ ...p, values, locked, revealed, reveals: p.reveals + 1, solved: true });
  };

  const clearGrid = () => {
    setWrong(new Set());
    setConfirm(null);
    setBanner(null);
    commit(emptyProg());
    setNotice("Grid cleared. Fresh start.");
    const first = model.across[0];
    if (first && first.cells[0] !== undefined) applySel(first.cells[0], "A");
  };

  const wordDone = (w: XWord): boolean =>
    w.cells.every((i) => prog.values[i] === model.sol[i]);

  const filled = model.letterCells.filter(
    (i) => (prog.values[i] ?? "") !== "",
  ).length;
  const allCorrectNow =
    model.total > 0 &&
    model.letterCells.every((i) => prog.values[i] === model.sol[i]);
  const isLate = latest !== undefined && latest.date < todayLocal();
  const lateNote =
    isLate && puzzle.id === latest?.id
      ? "Today's puzzle is late — this is the latest one. "
      : "";
  const fillText = `${lateNote}${filled} of ${model.total} squares filled · ${model.across.length} across, ${model.down.length} down`;
  const statusText =
    notice ??
    (filled === model.total && model.total > 0
      ? allCorrectNow
        ? "Puzzle complete."
        : "Every square is filled, but some letters are wrong. Check puzzle marks them."
      : fillText);
  const pct = model.total > 0 ? Math.round((filled / model.total) * 100) : 0;

  const archive = puzzles
    .filter((p) => p.id !== puzzle.id)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.no - a.no));

  const yPuzzle = puzzles.find(
    (p) => p.date === shiftDate(puzzle.date, -1),
  );
  const yProg = yPuzzle ? progMap[yPuzzle.id] : undefined;
  const yModel = useMemo(
    () => (yPuzzle ? buildModel(yPuzzle) : null),
    [yPuzzle],
  );
  const showYesterday = Boolean(yPuzzle && yProg?.solved && yModel);

  const renderClueList = (words: XWord[]) => (
    <div>
      {words.map((w) => (
        <button
          key={`${w.d}-${w.num}`}
          type="button"
          className={`clue-btn${currentWord === w ? " sel" : ""}${wordDone(w) ? " done" : ""}`}
          aria-label={`Clue ${w.num} ${dirName(w.d)}: ${w.clue}`}
          onClick={() => focusWord(w)}
        >
          <span className="n">{w.num}</span>
          <span>
            {w.clue} <span className="len">({w.w.length})</span>
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="page">
      <div className="layout">
        <div className="board-col">
          <header>
            <div className="rules-top" aria-hidden="true">
              <div className="r3" />
              <div className="r1" />
            </div>
            <div className="masthead-row">
              <span className="mast-label">
                <span className="diamond" aria-hidden="true" />
                Chae&rsquo;s Daily Crossword
              </span>
              <span className="mast-date">
                {fmtLong(puzzle.date)} · No. {String(puzzle.no).padStart(3, "0")}
              </span>
            </div>
            <div className="rules-bottom" aria-hidden="true">
              <div className="r1" />
              <div className="r3" />
            </div>
          </header>

          <h1 className="theme-title">{puzzle.theme_line}</h1>
          <p className="tagline">Tap a square and type.</p>

          <div id="board" role="grid" aria-label="Crossword grid, 15 by 15">
            {Array.from({ length: CELLS }, (_, i) => {
              const ch = model.sol[i];
              if (ch === null || ch === undefined) {
                return <div key={i} className="cell block" aria-hidden="true" />;
              }
              const r = Math.floor(i / SIZE);
              const c = i % SIZE;
              const num = model.numbers.get(i);
              const clueNum =
                model.cellA.get(i)?.num ?? model.cellD.get(i)?.num ?? num ?? 0;
              const classes = [
                "cell",
                inWordSet.has(i) ? "in-word" : "",
                sel.idx === i ? "active" : "",
                wrong.has(i) ? "wrong" : "",
              ]
                .filter(Boolean)
                .join(" ");
              const inputClasses = [
                prog.locked[i] ? "locked" : "",
                prog.revealed[i] ? "revealed" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <div key={i} className={classes} role="gridcell">
                  {num !== undefined && <span className="num">{num}</span>}
                  <input
                    ref={(el) => {
                      inputRefs.current[i] = el;
                    }}
                    type="text"
                    value={prog.values[i] ?? ""}
                    aria-label={`Row ${r + 1}, column ${c + 1}, clue ${clueNum}`}
                    className={inputClasses || undefined}
                    maxLength={1}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    enterKeyHint="next"
                    onFocus={(e) => {
                      if (selRef.current.idx !== i) {
                        const dir = dirFor(i, selRef.current.dir);
                        setSel({ idx: i, dir });
                        selRef.current = { idx: i, dir };
                      }
                      e.currentTarget.select();
                    }}
                    onMouseDown={(e) => {
                      if (
                        selRef.current.idx === i &&
                        document.activeElement === e.currentTarget
                      ) {
                        toggleDirection(i);
                      }
                    }}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, i)}
                  />
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="current-clue"
            aria-live="polite"
            aria-label={
              currentWord
                ? `Current clue: ${currentWord.num} ${dirName(currentWord.d)}, ${currentWord.clue}. Tap to switch direction.`
                : "Current clue"
            }
            onClick={() => toggleDirection(sel.idx)}
          >
            {currentWord && (
              <>
                <span className="cb-num">{currentWord.num}</span>
                <span className="cb-dir">
                  {currentWord.d === "A" ? "Across" : "Down"}
                </span>
                <span className="cb-clue">
                  {currentWord.clue} ({currentWord.w.length})
                </span>
                <span className="cb-hint">tap to switch direction</span>
              </>
            )}
          </button>

          <div className="toolbar">
            <button type="button" className="btn primary" onClick={checkPuzzle}>
              Check puzzle
            </button>
            <button type="button" className="btn" onClick={revealLetter}>
              Reveal letter
            </button>
            <button type="button" className="btn" onClick={revealWord}>
              Reveal word
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setConfirm("reveal")}
            >
              Reveal puzzle
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setConfirm("clear")}
            >
              Clear
            </button>
          </div>

          {confirm === "reveal" && (
            <div className="confirm-row">
              <span>Reveal the whole puzzle?</span>
              <button type="button" className="btn primary" onClick={revealPuzzle}>
                Reveal puzzle
              </button>
              <button type="button" className="btn" onClick={() => setConfirm(null)}>
                Cancel
              </button>
            </div>
          )}
          {confirm === "clear" && (
            <div className="confirm-row">
              <span>Clear the whole grid?</span>
              <button type="button" className="btn primary" onClick={clearGrid}>
                Clear grid
              </button>
              <button type="button" className="btn" onClick={() => setConfirm(null)}>
                Cancel
              </button>
            </div>
          )}

          <div className="level-switch" aria-label="Difficulty for the next puzzles">
            <span>Next puzzles:</span>
            {(["easy", "medium", "hard"] as Level[]).map((l, li) => (
              <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {li > 0 && <span aria-hidden="true">·</span>}
                <button
                  type="button"
                  aria-pressed={level === l}
                  aria-label={`Set level to ${l}`}
                  onClick={() => {
                    setLevel(l);
                    levelMut.mutate(l);
                  }}
                >
                  {l[0]?.toUpperCase()}
                  {l.slice(1)}
                </button>
              </span>
            ))}
          </div>

          <p className="status" aria-live="polite">
            {statusText}
          </p>
          <div
            className="progress"
            role="progressbar"
            aria-label="Squares filled"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div style={{ width: `${pct}%` }} />
          </div>

          {banner && (
            <div className="banner" role="status">
              <h2>{banner.headline}</h2>
              <p>{banner.body}</p>
            </div>
          )}
        </div>

        <div className="clue-col">
          <div className="clues-grid">
            <section aria-label="Across clues">
              <h2 className="col-head">Across</h2>
              {renderClueList(model.across)}
            </section>
            <section aria-label="Down clues">
              <h2 className="col-head">Down</h2>
              {renderClueList(model.down)}
            </section>
          </div>

          {archive.length > 0 && (
            <section className="archive" aria-label="Archive">
              <h2 className="col-head">Archive</h2>
              {archive.map((p) => {
                const ap = progMap[p.id];
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="archive-btn"
                    aria-label={`Open the puzzle from ${fmtLong(p.date)}: ${p.theme_line}`}
                    onClick={() => onOpen(p.id)}
                  >
                    <span className="arch-date">{fmtShort(p.date)}</span>
                    <span>{p.theme_line}</span>
                    <span className="arch-state">
                      ({ap?.solved ? "solved" : "in progress"})
                    </span>
                  </button>
                );
              })}
            </section>
          )}

          {showYesterday && yPuzzle && yModel && (
            <div className="yesterday" aria-label="Yesterday's answers">
              <span className="y-head">Yesterday&rsquo;s Answers</span>
              {" — "}
              {[...yModel.across, ...yModel.down]
                .map((w) => `${w.num} ${w.w}`)
                .join(" · ")}
            </div>
          )}
        </div>
      </div>

      <footer className="foot">
        Tap a clue to jump to its word. Tap the selected square again to switch
        between Across and Down.
      </footer>
    </div>
  );
}
