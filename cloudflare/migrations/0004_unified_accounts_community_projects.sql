CREATE TABLE IF NOT EXISTS community_projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  field TEXT NOT NULL,
  project_type TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  instagram_url TEXT NOT NULL DEFAULT '',
  facebook_url TEXT NOT NULL DEFAULT '',
  entity_name TEXT NOT NULL DEFAULT '',
  placement TEXT NOT NULL DEFAULT 'projects',
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_community_projects_status_created ON community_projects(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_projects_user ON community_projects(user_id, created_at DESC);
