DROP TABLE entries;
--> statement-breakpoint
CREATE TABLE puzzles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  no INTEGER NOT NULL,
  theme_line TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT '보통',
  words TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE progress (
  puzzle_id INTEGER PRIMARY KEY,
  "values" TEXT NOT NULL,
  locked TEXT NOT NULL,
  revealed TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  solved_at INTEGER,
  reveals INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE settings (
  id INTEGER PRIMARY KEY,
  level TEXT NOT NULL DEFAULT '보통',
  interests TEXT NOT NULL DEFAULT '[]'
);
--> statement-breakpoint
INSERT INTO settings (id, level, interests) VALUES (1, '보통', '["사회주택","통합돌봄","에너지 복지","자동화","서울"]');
--> statement-breakpoint
INSERT INTO puzzles (date, no, theme_line, level, words) VALUES ('2026-11-15', 1, '함께 사는 집, 함께 나누는 온기', '보통', '[{"w":"연대","r":5,"c":6,"d":"A","clue":"어려울 때 서로 손을 맞잡는 일"},{"w":"주택","r":6,"c":7,"d":"A","clue":"집의 격식 있는 이름"},{"w":"사회주택","r":7,"c":4,"d":"A","clue":"시세보다 낮은 임대료로 오래 살 수 있게 공공과 비영리가 공급하는 집"},{"w":"에너지바우처","r":10,"c":4,"d":"A","clue":"취약계층의 전기·가스·난방비를 대신 내주는 정부 이용권"},{"w":"지역","r":12,"c":4,"d":"A","clue":"내가 사는 동네와 그 주변을 아우르는 말"},{"w":"임대주택","r":4,"c":7,"d":"D","clue":"보증금과 월세를 내고 빌려 사는 집"},{"w":"사회","r":6,"c":5,"d":"D","clue":"사람들이 모여 이루는 큰 무리"},{"w":"사진","r":7,"c":4,"d":"D","clue":"순간을 붙잡아 종이나 화면에 남긴 것"},{"w":"주거복지","r":7,"c":6,"d":"D","clue":"집 걱정 없이 살 수 있게 돕는 정책 분야"},{"w":"에너지","r":10,"c":4,"d":"D","clue":"일할 수 있는 힘, 전기도 열도 이것에서 나온다"},{"w":"우산","r":10,"c":8,"d":"D","clue":"비 오는 날 머리 위에 펴는 것"}]');
