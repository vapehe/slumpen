PRAGMA foreign_keys = ON;

-- Lotterier (varje genomförd dragning)
CREATE TABLE IF NOT EXISTS lotteries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  num_draws INTEGER NOT NULL,
  with_replacement BOOLEAN NOT NULL DEFAULT 0,
  name_column TEXT NOT NULL,
  seed TEXT
);

-- Deltagare/lotter (varje rad från CSV)
CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lottery_id INTEGER NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  data_json TEXT NOT NULL
);

-- Dragningsresultat (varje vinnare)
CREATE TABLE IF NOT EXISTS draws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lottery_id INTEGER NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  participant_id INTEGER NOT NULL REFERENCES participants(id),
  drawn_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(lottery_id, position)
);

CREATE INDEX IF NOT EXISTS idx_participants_lottery ON participants(lottery_id);
CREATE INDEX IF NOT EXISTS idx_draws_lottery ON draws(lottery_id);
