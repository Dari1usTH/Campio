// Package betalist reads the public BetaList search page (new startups and products).
//
// Selectors, verified against live markup on 2026-11-07:
//   - row:     div.startup-row
//   - link:    a[href^="/startups/"]  (slug = ID)
//   - name:    span.font-medium
//   - tagline: span.text-gray-500
//   - logo:    img
//
// BetaList search is fuzzy (a search for "laptop" also returns unrelated
// startups), so callers should filter results for relevance.
package betalist

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"

	"github.com/tibi/hackathon/backend/internal/model"
)

const userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

// ErrNoResults means the search page had no startup rows.
var ErrNoResults = errors.New("betalist: no startups found")

// Scraper fetches BetaList pages.
type Scraper struct {
	BaseURL string
	client  *http.Client
}

// New returns a BetaList scraper.
func New() *Scraper {
	return &Scraper{BaseURL: "https://betalist.com", client: &http.Client{Timeout: 15 * time.Second}}
}

// SearchAny searches for query; BetaList returns nothing for most multi-word
// queries, so it then searches the two longest words separately and merges
// the results. It returns the launches and the number of pages fetched.
func (s *Scraper) SearchAny(ctx context.Context, query string) ([]model.Launch, int, error) {
	ls, err := s.Search(ctx, query)
	pages := 1
	words := strings.Fields(query)
	if !errors.Is(err, ErrNoResults) || len(words) < 2 {
		return ls, pages, err
	}
	sort.SliceStable(words, func(i, j int) bool { return len(words[i]) > len(words[j]) })
	seen := map[string]bool{}
	var out []model.Launch
	for _, w := range words[:2] {
		if len(w) < 3 {
			continue
		}
		pages++
		got, err := s.Search(ctx, w)
		if err != nil && !errors.Is(err, ErrNoResults) {
			return out, pages, err
		}
		for _, l := range got {
			if !seen[l.ID] {
				seen[l.ID] = true
				out = append(out, l)
			}
		}
	}
	if len(out) == 0 {
		return nil, pages, ErrNoResults
	}
	return out, pages, nil
}

// Search returns the startups on the first search results page.
func (s *Scraper) Search(ctx context.Context, query string) ([]model.Launch, error) {
	u := s.BaseURL + "/search?" + url.Values{"q": {strings.TrimSpace(query)}}.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml")
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("betalist: status %d", resp.StatusCode)
	}
	return Parse(io.LimitReader(resp.Body, 4<<20), s.BaseURL)
}

// Parse extracts startups from a search results page.
func Parse(r io.Reader, baseURL string) ([]model.Launch, error) {
	doc, err := goquery.NewDocumentFromReader(r)
	if err != nil {
		return nil, err
	}
	var out []model.Launch
	seen := map[string]bool{}
	doc.Find("div.startup-row").Each(func(_ int, row *goquery.Selection) {
		href := row.Find(`a[href^="/startups/"]`).First().AttrOr("href", "")
		slug := strings.Trim(strings.TrimPrefix(href, "/startups/"), "/")
		name := strings.TrimSpace(row.Find("span.font-medium").First().Text())
		if slug == "" || name == "" || seen[slug] {
			return
		}
		seen[slug] = true
		out = append(out, model.Launch{
			ID:       slug,
			Name:     name,
			Tagline:  strings.Join(strings.Fields(row.Find("span.text-gray-500").First().Text()), " "),
			URL:      baseURL + "/startups/" + slug,
			ImageURL: row.Find("img").First().AttrOr("src", ""),
		})
	})
	if len(out) == 0 {
		return nil, ErrNoResults
	}
	return out, nil
}
