BEGIN;
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT, email TEXT UNIQUE, "emailVerified" TIMESTAMPTZ, image TEXT
);
CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, provider TEXT NOT NULL, "providerAccountId" TEXT NOT NULL,
  access_token TEXT, expires_at BIGINT, refresh_token TEXT, id_token TEXT,
  scope TEXT, session_state TEXT, token_type TEXT,
  UNIQUE (provider, "providerAccountId"),
  CHECK (access_token IS NULL AND refresh_token IS NULL AND id_token IS NULL)
);
CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  "sessionToken" TEXT NOT NULL UNIQUE,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions("userId");
CREATE TABLE IF NOT EXISTS investigations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(120) NOT NULL, source_text TEXT NOT NULL, analysis JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS investigations_owner_idx ON investigations(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  bucket_key TEXT PRIMARY KEY, hits INTEGER NOT NULL, reset_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_rate_expiry_idx ON auth_rate_limits(reset_at);
REVOKE ALL ON users, accounts, sessions, investigations, auth_rate_limits FROM PUBLIC;
COMMIT;
