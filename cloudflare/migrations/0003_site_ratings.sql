CREATE TABLE IF NOT EXISTS site_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_site_ratings_created ON site_ratings(created_at DESC);
