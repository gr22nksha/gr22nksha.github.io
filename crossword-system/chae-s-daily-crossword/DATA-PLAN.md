# Data Plan

## Context provenance
- `TODAY'S PUZZLE (No. 001, date 2026-11-15, level medium, theme_line "Home Is Where the Bot Is")` with the exact 15 words, coordinates, and clues listed in the verbatim request (prior user statement; this is the seed puzzle, stored verbatim as puzzle No. 001 and never overwritten).
- `settings {level: "medium", interests: ["social housing", "artificial intelligence", "automation", "Seoul"]}` (prior user statement; stored as the settings row defaults).
- `Publish two actions: one that reports today's puzzle date and whether it is finished, and one that adds a new puzzle ... without deleting or overwriting the archive or saved progress.` (prior user statement; defines the server action contract: `getTodayStatus` and `addPuzzle`, plus internal load/save actions the UI needs).
- The full structure/look/behavior specification in the verbatim request (masthead, palette CSS variables, fonts, keyboard behavior, check/reveal/clear semantics, status strings) is implemented literally; no design substitution.

## Tested sources
### Supplied puzzle grid (verbatim request)
**Used by**: seed migration for puzzle No. 001; client grid derivation (numbering, runs, solution map)
**Test command**: `python3` script placing all 15 words on a 15x15 grid, checking crossings, enumerating every across/down run of 2+ letters, and computing row-major numbering
**Sample output**: `cells 80, conflicts []`; across runs exactly [BRIDGE, MARKET, NEURAL, ROBOT, SEOUL, SOCIALHOUSING, TENANT]; down runs exactly [AGENT, COFFEE, GARDEN, HOUSING, LEASE, POLICY, SCRIPT, WINDOW]; numbering BRIDGE 1, GARDEN 2, HOUSING 3, NEURAL 4, SEOUL 5, LEASE 6, TENANT 7, POLICY 8, WINDOW 9, SOCIALHOUSING 10, AGENT 11, SCRIPT 12, COFFEE 13, ROBOT 14, MARKET 15
**Processing**: words stored as given ({w, r, c, d, clue}); the client derives blocks, cell numbers, word numbers, and the solution letter map from the word list at render time using the spec's row-major numbering rule. 80 letter cells, 145 blocks.

### Google Fonts (Libre Franklin + Newsreader)
**Used by**: client/index.html link tags only (display=swap, preconnect), per spec
**Test command**: fonts named explicitly in the verbatim request; no fetch probe needed — standard Google Fonts stylesheet URL pattern with the exact families/weights specified (Libre Franklin 400;600;700, Newsreader ital,opsz,wght 400;600 + italic 400)
**Processing**: linked, never self-hosted or bundled; page remains fully functional if fonts fall back to serif/sans stacks.

## Long-term data behavior
- **Refresh policy**: No scheduled refresh and no external feed. Puzzles arrive only through the published `addPuzzle` action; the client loads all puzzles, progress, and settings on open via one `getState` action and saves progress on every change via `saveProgress`.
- **Growth**: One row per puzzle (append-only; `addPuzzle` rejects a duplicate date/no and never touches existing rows), one progress row per puzzle (upserted by puzzle id), one settings row.
- **Ordering**: Archive lists every puzzle except the open one, newest first by date then number. Clue lists sort by computed word number.
- **Time semantics**: Puzzle dates are plain `YYYY-MM-DD` calendar dates (no timezone conversion); masthead weekday/month/day are derived from the date string in UTC to avoid off-by-one. `started_at`/`solved_at` are epoch-ms instants. "Today" and "yesterday" are computed against the puzzle dates present, with the latest puzzle treated as today's; when the newest puzzle's date is before the viewer's local today, the status line notes today's puzzle is late above the latest puzzle.

## Rejected approaches
- **Tried**: Storing a precomputed 225-cell solution grid per puzzle in the seed
  **Why rejected**: The spec's data model is the word list; deriving the grid client-side from words guarantees numbering and runs always agree with the stored data, including future puzzles added via `addPuzzle`.
- **Tried**: Client-only localStorage persistence
  **Why rejected**: The spec requires progress saved in the Space's data (server DB) so it survives across devices and so the archive/status actions can read it.

Imagery not needed: the spec explicitly says assets are Google Fonts only, no images or icons, favicon is an empty data: URI; the print texture is an inline SVG feTurbulence layer, not an image file.
