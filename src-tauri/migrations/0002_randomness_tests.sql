CREATE TABLE IF NOT EXISTS randomness_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  source TEXT NOT NULL,              -- 'synthetic' eller 'historical'
  sample_size INTEGER NOT NULL,
  min_value INTEGER NOT NULL,
  max_value INTEGER NOT NULL,
  chi_square_stat REAL NOT NULL,
  chi_square_p REAL NOT NULL,
  chi_square_passed INTEGER NOT NULL,
  runs_stat REAL NOT NULL,
  runs_p REAL NOT NULL,
  runs_passed INTEGER NOT NULL,
  serial_correlation REAL NOT NULL,
  overall_passed INTEGER NOT NULL,
  frequency_json TEXT NOT NULL,      -- frekvensarray som JSON
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_tests_created ON randomness_tests(created_at DESC);

