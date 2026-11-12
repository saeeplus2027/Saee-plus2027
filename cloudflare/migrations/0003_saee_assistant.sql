CREATE TABLE IF NOT EXISTS saee_assistant_questions (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS saee_assistant_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  fallback_text TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO saee_assistant_settings (id, fallback_text, phone, updated_at)
VALUES (1, 'ليس لدي جواب لمعرفة الجواب تواصل عبر الرقم التالي', '', 0);
