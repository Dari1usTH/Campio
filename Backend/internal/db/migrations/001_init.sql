CREATE TABLE IF NOT EXISTS market_snapshots (
    id          BIGSERIAL PRIMARY KEY,
    keyword     TEXT        NOT NULL,
    source      TEXT        NOT NULL,             -- live | seed
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    data        JSONB       NOT NULL              -- model.MarketSnapshot
);
CREATE INDEX IF NOT EXISTS market_snapshots_kw_idx ON market_snapshots (keyword, source, fetched_at DESC);

CREATE TABLE IF NOT EXISTS trend_series (
    id          BIGSERIAL PRIMARY KEY,
    keyword     TEXT        NOT NULL,
    geo         TEXT        NOT NULL DEFAULT 'RO',
    source      TEXT        NOT NULL,
    fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    data        JSONB       NOT NULL              -- model.TrendSeries
);
CREATE INDEX IF NOT EXISTS trend_series_kw_idx ON trend_series (keyword, source, fetched_at DESC);

-- A marketing kit: generated asynchronously step by step.
CREATE TABLE IF NOT EXISTS campaigns (
    id           UUID PRIMARY KEY,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    status       TEXT        NOT NULL,            -- running | completed | failed
    step         TEXT        NOT NULL,            -- market | strategy | content | plan | done
    error        TEXT,
    product_name TEXT        NOT NULL,
    keyword      TEXT        NOT NULL,
    kit          JSONB       NOT NULL,            -- campaign.Kit (API view, filled progressively)
    market       JSONB,                           -- raw model.MarketSnapshot
    trends       JSONB,                           -- raw model.TrendSeries
    ai_cost_usd  DOUBLE PRECISION NOT NULL DEFAULT 0,
    pages_fetched INT        NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS campaigns_created_idx ON campaigns (created_at DESC);

-- Media files: generated clips, edited videos, uploads.
CREATE TABLE IF NOT EXISTS assets (
    id           UUID PRIMARY KEY,
    campaign_id  UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    kind         TEXT        NOT NULL,            -- generated | edited | upload
    role         TEXT,                            -- product_image | logo | music | footage (uploads)
    status       TEXT        NOT NULL,            -- pending | in_progress | completed | failed
    name         TEXT        NOT NULL,
    mime         TEXT        NOT NULL DEFAULT '',
    file_path    TEXT        NOT NULL DEFAULT '', -- relative to MEDIA_DIR
    size_bytes   BIGINT      NOT NULL DEFAULT 0,
    duration_s   DOUBLE PRECISION NOT NULL DEFAULT 0,
    width        INT         NOT NULL DEFAULT 0,
    height       INT         NOT NULL DEFAULT 0,
    cost_usd     DOUBLE PRECISION NOT NULL DEFAULT 0,
    meta         JSONB       NOT NULL DEFAULT '{}'::jsonb,
    error        TEXT
);
CREATE INDEX IF NOT EXISTS assets_campaign_idx ON assets (campaign_id, created_at);
CREATE INDEX IF NOT EXISTS assets_status_idx ON assets (status);

-- AI video-editing sessions.
CREATE TABLE IF NOT EXISTS edits (
    id              UUID PRIMARY KEY,
    campaign_id     UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    status          TEXT        NOT NULL,         -- running | completed | failed
    instructions    TEXT        NOT NULL,
    input_asset_ids JSONB       NOT NULL DEFAULT '[]'::jsonb,
    steps           JSONB       NOT NULL DEFAULT '[]'::jsonb,
    output_asset_id UUID,
    title           TEXT,
    notes           TEXT,
    cost_usd        DOUBLE PRECISION NOT NULL DEFAULT 0,
    error           TEXT
);
CREATE INDEX IF NOT EXISTS edits_campaign_idx ON edits (campaign_id, created_at);

CREATE TABLE IF NOT EXISTS chat_messages (
    id           BIGSERIAL PRIMARY KEY,
    campaign_id  UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    role         TEXT        NOT NULL,            -- user | assistant
    content      TEXT        NOT NULL,
    simulations  JSONB,                           -- budget simulations run by the assistant
    cost_usd     DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_campaign_idx ON chat_messages (campaign_id, id);
