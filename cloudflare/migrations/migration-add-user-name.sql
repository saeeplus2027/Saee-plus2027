-- Run once in the existing Cloudflare D1 database.
ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT '';
