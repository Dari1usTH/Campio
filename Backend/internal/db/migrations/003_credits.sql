ALTER TABLE users ADD COLUMN credit_usd NUMERIC(14,6) NOT NULL DEFAULT 0;
CREATE TABLE credit_transactions (
 id BIGSERIAL PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 amount_usd NUMERIC(14,6) NOT NULL,
 kind TEXT NOT NULL CHECK (kind IN ('signup_bonus','purchase','usage')),
 description TEXT NOT NULL DEFAULT '',
 campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX credit_tx_user ON credit_transactions(user_id, created_at DESC);
-- Existing accounts get the same welcome credit as new ones.
INSERT INTO credit_transactions(user_id, amount_usd, kind, description) SELECT id, 3, 'signup_bonus', 'Welcome credit' FROM users;
UPDATE users SET credit_usd = 3;
