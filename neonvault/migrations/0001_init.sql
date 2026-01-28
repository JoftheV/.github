PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS objects (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL UNIQUE,
  owner_sub TEXT NOT NULL,
  owner_email TEXT,
  filename TEXT,
  content_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  sha256_hex TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_objects_owner_sub ON objects(owner_sub);
CREATE INDEX IF NOT EXISTS idx_objects_created_at ON objects(created_at);

CREATE TABLE IF NOT EXISTS audit (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actor_sub TEXT NOT NULL,
  actor_email TEXT,
  action TEXT NOT NULL,          -- UPLOAD, DOWNLOAD, DELETE, META_READ, META_WRITE, LIST
  object_id TEXT,
  r2_key TEXT,
  ok INTEGER NOT NULL,           -- 1/0
  status INTEGER NOT NULL,       -- http status
  request_id TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_at ON audit(at);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit(actor_sub);
CREATE INDEX IF NOT EXISTS idx_audit_object_id ON audit(object_id);
