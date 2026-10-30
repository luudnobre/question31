-- Referência. O Worker cria as tabelas automaticamente.
CREATE TABLE IF NOT EXISTS rooms (
 code TEXT PRIMARY KEY, title TEXT NOT NULL, admin_hash TEXT NOT NULL,
 pin_hash TEXT, is_open INTEGER NOT NULL DEFAULT 1 CHECK(is_open IN (0,1)),
 featured_id TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('admin','guest')), expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_room ON sessions(room_code);
CREATE TABLE IF NOT EXISTS questions (
 id TEXT PRIMARY KEY, room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
 submission_id TEXT NOT NULL, session_hash TEXT NOT NULL, body TEXT NOT NULL,
 display_name TEXT, status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','answered','archived')),
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(room_code, submission_id)
);
CREATE INDEX IF NOT EXISTS questions_room_date ON questions(room_code, created_at DESC);
CREATE INDEX IF NOT EXISTS questions_room_status ON questions(room_code, status, created_at DESC);
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS rate_expiry ON rate_limits(expires_at);
