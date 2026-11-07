// Package db wraps the PostgreSQL connection pool, migrations and queries.
package db

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tibi/hackathon/backend/internal/model"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// ErrNotFound is returned when a row does not exist.
var ErrNotFound = errors.New("not found")

// Store is the data access layer.
type Store struct {
	Pool *pgxpool.Pool
	// CreditMarkup multiplies every AI cost before it is deducted from the
	// owner's credit balance (0 or unset means 1).
	CreditMarkup float64
}

// Connect opens the pool, retrying while Postgres starts up.
func Connect(ctx context.Context, url string) (*Store, error) {
	var lastErr error
	for i := 0; i < 30; i++ {
		pool, err := pgxpool.New(ctx, url)
		if err == nil {
			if err = pool.Ping(ctx); err == nil {
				return &Store{Pool: pool}, nil
			}
			pool.Close()
		}
		lastErr = err
		if i%5 == 0 {
			slog.Warn("waiting for postgres", "attempt", i+1, "err", err)
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(time.Second):
		}
	}
	return nil, fmt.Errorf("connect postgres: %w", lastErr)
}

// Close closes the pool.
func (s *Store) Close() { s.Pool.Close() }

// Migrate applies embedded migrations in filename order.
func (s *Store) Migrate(ctx context.Context) error {
	if _, err := s.Pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
		return err
	}
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return err
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })
	for _, e := range entries {
		var exists bool
		if err := s.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name=$1)`, e.Name()).Scan(&exists); err != nil {
			return err
		}
		if exists {
			continue
		}
		sqlBytes, err := migrationsFS.ReadFile("migrations/" + e.Name())
		if err != nil {
			return err
		}
		err = pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
			if _, err := tx.Exec(ctx, string(sqlBytes)); err != nil {
				return err
			}
			_, err := tx.Exec(ctx, `INSERT INTO schema_migrations (name) VALUES ($1)`, e.Name())
			return err
		})
		if err != nil {
			return fmt.Errorf("migration %s: %w", e.Name(), err)
		}
	}
	return nil
}

// ---- market snapshots ----

// SaveSnapshot stores a market snapshot.
func (s *Store) SaveSnapshot(ctx context.Context, snap model.MarketSnapshot) error {
	b, _ := json.Marshal(snap)
	_, err := s.Pool.Exec(ctx, `INSERT INTO market_snapshots (keyword, source, fetched_at, data) VALUES ($1,$2,$3,$4)`,
		snap.Keyword, snap.Source, snap.FetchedAt, b)
	return err
}

// LatestSnapshot returns the newest snapshot for keyword from source newer than since.
func (s *Store) LatestSnapshot(ctx context.Context, keyword, source string, since time.Time) (model.MarketSnapshot, error) {
	var snap model.MarketSnapshot
	var b []byte
	err := s.Pool.QueryRow(ctx, `SELECT data FROM market_snapshots WHERE keyword=$1 AND source=$2 AND fetched_at >= $3 ORDER BY fetched_at DESC LIMIT 1`,
		keyword, source, since).Scan(&b)
	if errors.Is(err, pgx.ErrNoRows) {
		return snap, ErrNotFound
	}
	if err != nil {
		return snap, err
	}
	return snap, json.Unmarshal(b, &snap)
}

// SeedKeywords lists keywords that have seed data.
func (s *Store) SeedKeywords(ctx context.Context) ([]string, error) {
	rows, err := s.Pool.Query(ctx, `SELECT DISTINCT keyword FROM market_snapshots WHERE source='seed' ORDER BY keyword`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[string])
}

// ---- web snapshots (Amazon, Reddit, BetaList) ----

// SaveWeb stores a web snapshot under cacheKey.
func (s *Store) SaveWeb(ctx context.Context, cacheKey string, w model.WebSnapshot) error {
	b, _ := json.Marshal(w)
	_, err := s.Pool.Exec(ctx, `INSERT INTO web_snapshots (cache_key, fetched_at, data) VALUES ($1,$2,$3)`, cacheKey, w.FetchedAt, b)
	return err
}

// LatestWeb returns the newest web snapshot for cacheKey newer than since.
func (s *Store) LatestWeb(ctx context.Context, cacheKey string, since time.Time) (model.WebSnapshot, error) {
	var w model.WebSnapshot
	var b []byte
	err := s.Pool.QueryRow(ctx, `SELECT data FROM web_snapshots WHERE cache_key=$1 AND fetched_at >= $2 ORDER BY fetched_at DESC LIMIT 1`, cacheKey, since).Scan(&b)
	if errors.Is(err, pgx.ErrNoRows) {
		return w, ErrNotFound
	}
	if err != nil {
		return w, err
	}
	return w, json.Unmarshal(b, &w)
}

// ---- trends ----

// SaveTrend stores a trend series.
func (s *Store) SaveTrend(ctx context.Context, ts model.TrendSeries) error {
	b, _ := json.Marshal(ts)
	_, err := s.Pool.Exec(ctx, `INSERT INTO trend_series (keyword, geo, source, fetched_at, data) VALUES ($1,$2,$3,$4,$5)`,
		ts.Keyword, ts.Geo, ts.Source, ts.FetchedAt, b)
	return err
}

// LatestTrend returns the newest series for keyword from source newer than since.
func (s *Store) LatestTrend(ctx context.Context, keyword, source string, since time.Time) (model.TrendSeries, error) {
	var ts model.TrendSeries
	var b []byte
	err := s.Pool.QueryRow(ctx, `SELECT data FROM trend_series WHERE keyword=$1 AND source=$2 AND fetched_at >= $3 ORDER BY fetched_at DESC LIMIT 1`,
		keyword, source, since).Scan(&b)
	if errors.Is(err, pgx.ErrNoRows) {
		return ts, ErrNotFound
	}
	if err != nil {
		return ts, err
	}
	return ts, json.Unmarshal(b, &ts)
}

// ReplaceSeed atomically replaces seed rows for a keyword.
func (s *Store) ReplaceSeed(ctx context.Context, snap model.MarketSnapshot, ts model.TrendSeries) error {
	return pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `DELETE FROM market_snapshots WHERE keyword=$1 AND source='seed'`, snap.Keyword); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM trend_series WHERE keyword=$1 AND source='seed'`, snap.Keyword); err != nil {
			return err
		}
		mb, _ := json.Marshal(snap)
		if _, err := tx.Exec(ctx, `INSERT INTO market_snapshots (keyword, source, fetched_at, data) VALUES ($1,'seed',$2,$3)`, snap.Keyword, snap.FetchedAt, mb); err != nil {
			return err
		}
		if len(ts.Points) > 0 {
			tb, _ := json.Marshal(ts)
			if _, err := tx.Exec(ctx, `INSERT INTO trend_series (keyword, geo, source, fetched_at, data) VALUES ($1,$2,'seed',$3,$4)`, ts.Keyword, ts.Geo, ts.FetchedAt, tb); err != nil {
				return err
			}
		}
		return nil
	})
}
