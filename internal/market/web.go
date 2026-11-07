package market

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/tibi/hackathon/backend/internal/model"
	"github.com/tibi/hackathon/backend/internal/scraper/amazon"
	"github.com/tibi/hackathon/backend/internal/scraper/betalist"
	"github.com/tibi/hackathon/backend/internal/scraper/reddit"
	"github.com/tibi/hackathon/backend/internal/seed"
)

// WebSources are the optional non-eMAG sources. A nil scraper means disabled.
type WebSources struct {
	Amazon   *amazon.Scraper
	Reddit   *reddit.Client
	BetaList *betalist.Scraper
}

// MaxSubreddits caps how many subreddits are searched per query (Arctic Shift rate limits are tight).
const MaxSubreddits = 3

var subredditRe = regexp.MustCompile(`^[A-Za-z0-9_]{2,21}$`)

// CleanSubreddits strips "r/" prefixes, drops invalid names and duplicates, and caps the list.
func CleanSubreddits(in []string) []string {
	out := []string{}
	seen := map[string]bool{}
	for _, s := range in {
		s = strings.TrimSpace(s)
		s = strings.TrimPrefix(strings.TrimPrefix(s, "/"), "r/")
		if !subredditRe.MatchString(s) || seen[strings.ToLower(s)] {
			continue
		}
		seen[strings.ToLower(s)] = true
		out = append(out, s)
		if len(out) == MaxSubreddits {
			break
		}
	}
	return out
}

func webCacheKey(query string, subs []string) string {
	ls := make([]string, len(subs))
	for i, s := range subs {
		ls[i] = strings.ToLower(s)
	}
	sort.Strings(ls)
	return query + "|" + strings.Join(ls, ",")
}

// Web collects Amazon products, Reddit discussions and BetaList launches for an
// English query. It never fails: each source reports its own status, and a
// source that is blocked or down is simply skipped.
func (s *Service) Web(ctx context.Context, query string, subreddits []string) model.WebSnapshot {
	q := seed.NormalizeKeyword(query)
	subs := CleanSubreddits(subreddits)
	key := webCacheKey(q, subs)
	l := s.keyLock("w:" + key)
	l.Lock()
	defer l.Unlock()

	if w, err := s.Store.LatestWeb(ctx, key, time.Now().Add(-s.CacheTTL)); err == nil {
		w.Source = model.SourceCache
		w.PagesFetched = 0
		return w
	}

	w := model.WebSnapshot{Query: q, Subreddits: subs, Source: model.SourceLive, FetchedAt: time.Now().UTC(),
		Amazon: []model.WebProduct{}, Discussions: []model.Discussion{}, Launches: []model.Launch{}}
	if q == "" {
		w.Sources = []model.WebSourceStatus{
			{Name: model.WebAmazon, Status: model.WebStatusEmpty, Note: "Lipsește termenul de căutare în engleză."},
			{Name: model.WebReddit, Status: model.WebStatusEmpty, Note: "Lipsește termenul de căutare în engleză."},
			{Name: model.WebBetaList, Status: model.WebStatusEmpty, Note: "Lipsește termenul de căutare în engleză."},
		}
		return w
	}

	var (
		wg                          sync.WaitGroup
		amz, red, bl                model.WebSourceStatus
		amzPages, redPages, blPages int
		products                    []model.WebProduct
		discussions                 []model.Discussion
		launches                    []model.Launch
		amzCtx, amzCancel           = context.WithTimeout(ctx, 20*time.Second)
		redCtx, redCancel           = context.WithTimeout(ctx, 40*time.Second)
		blCtx, blCancel             = context.WithTimeout(ctx, 20*time.Second)
	)
	defer amzCancel()
	defer redCancel()
	defer blCancel()

	wg.Add(3)
	go func() {
		defer wg.Done()
		amz = model.WebSourceStatus{Name: model.WebAmazon}
		if s.WebSources.Amazon == nil {
			amz.Status, amz.Note = model.WebStatusDisabled, "Amazon este dezactivat."
			return
		}
		ps, err := s.WebSources.Amazon.Search(amzCtx, q)
		amzPages = 1
		products = ps
		amz.Status, amz.Items = statusOf(err, len(ps)), len(ps)
		switch {
		case errors.Is(err, amazon.ErrBlocked):
			amz.Note = "Amazon a cerut verificare anti-bot; sursa a fost sărită."
		case errors.Is(err, amazon.ErrNoResults):
			amz.Note = fmt.Sprintf("Niciun produs pe Amazon pentru „%s”.", q)
		case err != nil:
			amz.Note = "Amazon indisponibil momentan."
			slog.Warn("amazon search", "query", q, "err", err)
		}
	}()
	go func() {
		defer wg.Done()
		red = model.WebSourceStatus{Name: model.WebReddit}
		if s.WebSources.Reddit == nil {
			red.Status, red.Note = model.WebStatusDisabled, "Reddit este dezactivat."
			return
		}
		if len(subs) == 0 {
			red.Status, red.Note = model.WebStatusEmpty, "Niciun subreddit potrivit pentru acest produs."
			return
		}
		res, err := s.WebSources.Reddit.Search(redCtx, q, subs)
		redPages = res.Requests
		discussions = res.Discussions
		red.Items = len(res.Discussions)
		red.Status = statusOf(err, red.Items)
		var notes []string
		if res.RateLimited {
			if red.Items == 0 {
				red.Status = model.WebStatusBlocked
			}
			notes = append(notes, "Arhiva Reddit a limitat cererile; rezultate parțiale.")
		}
		if len(res.TimedOut) > 0 {
			notes = append(notes, "Căutarea a expirat în r/"+strings.Join(res.TimedOut, ", r/")+".")
		}
		if err != nil {
			notes = append(notes, "Arhiva Reddit indisponibilă momentan.")
			slog.Warn("reddit search", "query", q, "err", err)
		}
		red.Note = strings.Join(notes, " ")
	}()
	go func() {
		defer wg.Done()
		bl = model.WebSourceStatus{Name: model.WebBetaList}
		if s.WebSources.BetaList == nil {
			bl.Status, bl.Note = model.WebStatusDisabled, "BetaList este dezactivat."
			return
		}
		ls, pages, err := s.WebSources.BetaList.SearchAny(blCtx, q)
		launches, blPages = ls, pages
		bl.Status, bl.Items = statusOf(err, len(ls)), len(ls)
		if err != nil && !errors.Is(err, betalist.ErrNoResults) {
			bl.Note = "BetaList indisponibil momentan."
			slog.Warn("betalist search", "query", q, "err", err)
		}
	}()
	wg.Wait()

	w.PagesFetched = amzPages + redPages + blPages
	w.Sources = []model.WebSourceStatus{amz, red, bl}
	if products != nil {
		w.Amazon = products
	}
	if discussions != nil {
		w.Discussions = discussions
	}
	if launches != nil {
		w.Launches = launches
	}
	if amz.Status == model.WebStatusOK || red.Status == model.WebStatusOK || bl.Status == model.WebStatusOK {
		if err := s.Store.SaveWeb(ctx, key, w); err != nil {
			slog.Warn("save web snapshot", "err", err)
		}
	}
	return w
}

func statusOf(err error, n int) string {
	switch {
	case n > 0:
		return model.WebStatusOK
	case errors.Is(err, amazon.ErrBlocked), errors.Is(err, reddit.ErrRateLimited):
		return model.WebStatusBlocked
	case err == nil, errors.Is(err, amazon.ErrNoResults), errors.Is(err, betalist.ErrNoResults):
		return model.WebStatusEmpty
	}
	return model.WebStatusError
}
