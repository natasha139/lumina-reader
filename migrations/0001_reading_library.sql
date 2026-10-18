-- Additive migration. The legacy sessions table remains intact.
-- Also supports a fresh local installation with no legacy table.
CREATE TABLE IF NOT EXISTS sessions (
  user_id TEXT PRIMARY KEY,
  sync_code TEXT NOT NULL,
  session_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS reading_libraries (
  id TEXT PRIMARY KEY,
  sync_code TEXT NOT NULL UNIQUE,
  library_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS reading_devices (
  device_id TEXT PRIMARY KEY,
  library_id TEXT NOT NULL REFERENCES reading_libraries(id)
);
CREATE INDEX IF NOT EXISTS reading_devices_library ON reading_devices(library_id);
