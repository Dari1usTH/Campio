CREATE TABLE users (
 id UUID PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL DEFAULT '',
 name TEXT NOT NULL, business_name TEXT NOT NULL DEFAULT '', language TEXT NOT NULL DEFAULT 'en' CHECK(language IN ('en','ro')),
 verified BOOLEAN NOT NULL DEFAULT false, two_factor_enabled BOOLEAN NOT NULL DEFAULT true,
 two_factor_method TEXT NOT NULL DEFAULT 'email', totp_secret TEXT NOT NULL DEFAULT '',
 is_test BOOLEAN NOT NULL DEFAULT false, settings JSONB NOT NULL DEFAULT '{}', onboarding JSONB NOT NULL DEFAULT '{"completed":[],"activity":[]}',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), device TEXT NOT NULL DEFAULT '');
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE auth_challenges (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 code_hash TEXT NOT NULL, method TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, attempts INT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE reset_tokens (token_hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL);
ALTER TABLE campaigns ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE campaigns ADD COLUMN ui_data JSONB NOT NULL DEFAULT '{}';
CREATE INDEX campaigns_owner ON campaigns(user_id,created_at DESC);
CREATE TABLE notifications (id UUID PRIMARY KEY,user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL,body TEXT NOT NULL,href TEXT NOT NULL DEFAULT '',read BOOLEAN NOT NULL DEFAULT false,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
