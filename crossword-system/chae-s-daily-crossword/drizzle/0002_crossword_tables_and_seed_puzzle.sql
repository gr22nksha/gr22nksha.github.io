DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE puzzles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  no INTEGER NOT NULL UNIQUE,
  theme_line TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'medium',
  words TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE progress (
  puzzle_id INTEGER PRIMARY KEY REFERENCES puzzles(id),
  "values" TEXT NOT NULL,
  locked TEXT NOT NULL,
  revealed TEXT NOT NULL,
  started_at INTEGER,
  solved_at INTEGER,
  reveals INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE settings (
  id INTEGER PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'medium',
  interests TEXT NOT NULL
);
--> statement-breakpoint
INSERT INTO settings (id, level, interests) VALUES (1, 'medium', '["social housing","artificial intelligence","automation","Seoul"]');
--> statement-breakpoint
INSERT INTO puzzles (date, no, theme_line, level, words) VALUES ('2026-11-15', 1, 'Home Is Where the Bot Is', 'medium', '[{"w":"BRIDGE","r":0,"c":0,"d":"A","clue":"Contract game for four players"},{"w":"NEURAL","r":2,"c":1,"d":"A","clue":"Brain-inspired, in computing: ___ network"},{"w":"SEOUL","r":3,"c":10,"d":"A","clue":"Capital crossed by the Han River"},{"w":"TENANT","r":5,"c":0,"d":"A","clue":"Rent payer"},{"w":"SOCIALHOUSING","r":7,"c":1,"d":"A","clue":"Affordable homes run for public benefit, not profit"},{"w":"ROBOT","r":10,"c":10,"d":"A","clue":"Warehouse worker that never takes a break?"},{"w":"MARKET","r":11,"c":0,"d":"A","clue":"Where stalls, prices and Saturday crowds meet"},{"w":"GARDEN","r":0,"c":4,"d":"D","clue":"Plot that grows on you?"},{"w":"HOUSING","r":1,"c":13,"d":"D","clue":"Roof-over-heads issue in every election"},{"w":"LEASE","r":4,"c":1,"d":"D","clue":"Tenancy agreement in writing"},{"w":"POLICY","r":6,"c":8,"d":"D","clue":"Government plan, or an insurance contract"},{"w":"WINDOW","r":6,"c":11,"d":"D","clue":"It lets the light in but keeps the rain out"},{"w":"AGENT","r":7,"c":5,"d":"D","clue":"One who acts for another — lately, a program that acts on its own?"},{"w":"SCRIPT","r":9,"c":2,"d":"D","clue":"Code that runs the same chores every time"},{"w":"COFFEE","r":9,"c":13,"d":"D","clue":"Morning cup that fuels the solving"}]');
