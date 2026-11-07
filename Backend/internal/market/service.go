// Package market resolves market data for a keyword: fresh cache, then live
// scraping, then precollected seed data so a demo never breaks.
package market

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/tibi/hackathon/backend/internal/db"
	"github.com/tibi/hackathon/backend/internal/model"
	"github.com/tibi/hackathon/backend/internal/scraper/emag"
	"github.com/tibi/hackathon/backend/internal/seed"
	"github.com/tibi/hackathon/backend/internal/trends"
)

// ErrNoData means neither live scraping nor seed data produced results.
var ErrNoData = errors.New("no market data available for this keyword")

// Service fetches and caches market data.
type Service struct {
	Store          *db.Store
	Scraper        *emag.Scraper
	Trends         *trends.Client
	ScraperEnabled bool
	TrendsEnabled  bool
	CacheTTL       time.Duration

	mu    sync.Mutex
	locks map[string]*sync.Mutex
}

// keyLock serialises concurrent fetches of the same keyword.
func (s *Service) keyLock(k string) *sync.Mutex {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.locks == nil {
		s.locks = map[string]*sync.Mutex{}
	}
	if s.locks[k] == nil {
		s.locks[k] = &sync.Mutex{}
	}
	return s.locks[k]
}

// Snapshot returns eMAG market data for keyword.
func (s *Service) Snapshot(ctx context.Context, keyword string) (model.MarketSnapshot, error) {
	kw := seed.NormalizeKeyword(keyword)
	l := s.keyLock("m:" + kw)
	l.Lock()
	defer l.Unlock()

	if snap, err := s.Store.LatestSnapshot(ctx, kw, model.SourceLive, time.Now().Add(-s.CacheTTL)); err == nil {
		snap.Source = model.SourceCache
		snap.PagesFetched = 0 // nothing fetched for this request
		return snap, nil
	}

	var liveErr error
	if s.ScraperEnabled {
		sctx, cancel := context.WithTimeout(ctx, 45*time.Second)
		snap, err := s.Scraper.Scrape(sctx, kw)
		cancel()
		if err == nil {
			snap.Keyword = kw
			if err := s.Store.SaveSnapshot(ctx, snap); err != nil {
				slog.Warn("save snapshot", "err", err)
			}
			return snap, nil
		}
		liveErr = err
		slog.Warn("live scrape failed, trying seed", "keyword", kw, "err", err)
	} else {
		liveErr = errors.New("live scraping disabled")
	}

	if snap, err := s.Store.LatestSnapshot(ctx, kw, model.SourceSeed, time.Time{}); err == nil {
		snap.Source = model.SourceSeed
		snap.PagesFetched = 0
		snap.FallbackNote = fmt.Sprintf("Date precolectate (scraping live indisponibil: %v)", liveErr)
		return snap, nil
	}
	return model.MarketSnapshot{}, fmt.Errorf("%w: %v", ErrNoData, liveErr)
}

// Trend returns the Google Trends series for keyword. It never fails: when no
// data is available it returns an empty series with a note.
func (s *Service) Trend(ctx context.Context, keyword string) model.TrendSeries {
	kw := seed.NormalizeKeyword(keyword)
	l := s.keyLock("t:" + kw)
	l.Lock()
	defer l.Unlock()

	if ts, err := s.Store.LatestTrend(ctx, kw, model.SourceLive, time.Now().Add(-s.CacheTTL)); err == nil {
		ts.Source = model.SourceCache
		return ts
	}

	var liveErr error = errors.New("Google Trends disabled")
	if s.TrendsEnabled {
		candidates := []string{kw}
		if f := strings.Fields(kw); len(f) > 2 {
			candidates = append(candidates, strings.Join(f[:2], " "))
		}
		for i, c := range candidates {
			tctx, cancel := context.WithTimeout(ctx, 20*time.Second)
			ts, err := s.Trends.Fetch(tctx, c)
			cancel()
			if err != nil {
				liveErr = err
				continue
			}
			ts.Keyword = kw
			if i > 0 {
				ts.FallbackNote = fmt.Sprintf("Volum prea mic pentru „%s”; folosim termenul mai larg „%s”.", kw, c)
			}
			if err := s.Store.SaveTrend(ctx, ts); err != nil {
				slog.Warn("save trend", "err", err)
			}
			return ts
		}
		slog.Warn("live trends failed, trying seed", "keyword", kw, "err", liveErr)
	}

	if ts, err := s.Store.LatestTrend(ctx, kw, model.SourceSeed, time.Time{}); err == nil {
		ts.Source = model.SourceSeed
		ts.FallbackNote = "Date Google Trends precolectate."
		return ts
	}
	return model.TrendSeries{
		Keyword: kw, Geo: "RO", Source: "none", FetchedAt: time.Now().UTC(), Points: []model.TrendPoint{},
		FallbackNote: fmt.Sprintf("Nu există date Google Trends: %v", liveErr),
	}
}

// LoadSeeds upserts seed files into the database and returns their keywords.
func LoadSeeds(ctx context.Context, store *db.Store, dir string) ([]string, error) {
	files, err := seed.LoadDir(dir)
	if err != nil {
		return nil, err
	}
	kws := make([]string, 0, len(files))
	for _, f := range files {
		if err := store.ReplaceSeed(ctx, f.Market, f.Trends); err != nil {
			return nil, fmt.Errorf("seed %q: %w", f.Keyword, err)
		}
		kws = append(kws, f.Keyword)
	}
	return kws, nil
}
