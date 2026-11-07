-- Web sources besides eMAG / Google Trends: Amazon, Reddit (Arctic Shift), BetaList.
CREATE TABLE IF NOT EXISTS web_snapshots (
    id          BIGSERIAL PRIMARY KEY,
    cache_key   TEXT        NOT NULL,             -- normalized query | sorted subreddits
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    data        JSONB       NOT NULL              -- model.WebSnapshot
);
CREATE INDEX IF NOT EXISTS web_snapshots_key_idx ON web_snapshots (cache_key, fetched_at DESC);

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS web JSONB;  -- raw model.WebSnapshot
