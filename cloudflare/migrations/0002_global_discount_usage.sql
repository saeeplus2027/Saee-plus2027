-- Safe migration: shared 24-hour use limit for each discount ID.
CREATE TABLE IF NOT EXISTS discount_usage_global (
  discount_id TEXT PRIMARY KEY,
  used_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_discount_usage_global_expiry
  ON discount_usage_global(expires_at);
