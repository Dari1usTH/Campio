// Package reddit searches Reddit posts and comments through the Arctic Shift
// archive API (https://arctic-shift.photon-reddit.com, docs:
// github.com/ArthurHeitmann/arctic_shift/blob/master/api/README.md).
//
// Constraints verified on 2026-11-07:
//   - keyword search (query/body) requires a subreddit, so the caller passes a few
//     niche subreddits; very large ones (r/Romania, r/BuyItForLife) answer 422 "Timeout"
//   - rate limits are dynamic and tight: 429/422 come with X-RateLimit-Reset (seconds).
//     The client keeps requests few and sequential and stops at the first 429.
package reddit

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/tibi/hackathon/backend/internal/model"
)

// ErrRateLimited means Arctic Shift asked us to slow down; no more requests were made.
var ErrRateLimited = errors.New("reddit: rate limited by Arctic Shift")

// Client queries the Arctic Shift API.
type Client struct {
	BaseURL      string
	HTTP         *http.Client
	PerSubreddit int           // posts and comments fetched per subreddit
	MaxAge       time.Duration // only content newer than this
	RequestDelay time.Duration
}

// New returns a client with conservative defaults.
func New() *Client {
	return &Client{
		BaseURL:      "https://arctic-shift.photon-reddit.com",
		HTTP:         &http.Client{Timeout: 20 * time.Second},
		PerSubreddit: 25,
		MaxAge:       3 * 365 * 24 * time.Hour,
		RequestDelay: time.Second,
	}
}

// Result is what a search collected. It may be partial.
type Result struct {
	Discussions []model.Discussion
	Requests    int
	TimedOut    []string // subreddits the archive could not search in time
	RateLimited bool
}

// Search looks for query in posts and comments of each subreddit, in order.
// It returns partial results when the context ends or the API rate-limits us.
func (c *Client) Search(ctx context.Context, query string, subreddits []string) (Result, error) {
	var res Result
	after := time.Now().Add(-c.MaxAge).UTC().Format("2006-01-02")
	seen := map[string]bool{}
	var lastErr error
	for _, sub := range subreddits {
		for _, kind := range []string{"post", "comment"} {
			if res.Requests > 0 {
				select {
				case <-ctx.Done():
					return res, nil
				case <-time.After(c.RequestDelay):
				}
			}
			ds, err := c.search(ctx, kind, sub, query, after)
			res.Requests++
			if errors.Is(err, ErrRateLimited) {
				res.RateLimited = true
				return res, nil
			}
			if errors.Is(err, errTimeout) {
				res.TimedOut = append(res.TimedOut, sub)
				break // skip this subreddit's comments too
			}
			if err != nil {
				if ctx.Err() != nil {
					return res, nil
				}
				lastErr = err
				continue
			}
			for _, d := range ds {
				if !seen[d.ID] {
					seen[d.ID] = true
					res.Discussions = append(res.Discussions, d)
				}
			}
		}
	}
	if len(res.Discussions) == 0 && lastErr != nil && len(res.TimedOut) == 0 {
		return res, lastErr
	}
	return res, nil
}

var errTimeout = errors.New("reddit: archive search timed out")

type item struct {
	ID          string      `json:"id"`
	Subreddit   string      `json:"subreddit"`
	Title       string      `json:"title"`
	Selftext    string      `json:"selftext"`
	Body        string      `json:"body"`
	Score       int         `json:"score"`
	NumComments int         `json:"num_comments"`
	CreatedUTC  json.Number `json:"created_utc"`
	LinkID      string      `json:"link_id"`
}

func (c *Client) search(ctx context.Context, kind, sub, query, after string) ([]model.Discussion, error) {
	q := url.Values{"subreddit": {sub}, "after": {after}, "limit": {strconv.Itoa(max(1, min(100, c.PerSubreddit)))}}
	path := "/api/posts/search"
	if kind == "post" {
		q.Set("query", query)
		q.Set("fields", "id,subreddit,title,selftext,score,num_comments,created_utc")
	} else {
		path = "/api/comments/search"
		q.Set("body", query)
		q.Set("fields", "id,subreddit,body,score,created_utc,link_id")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+path+"?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "merita-lansat/1.0 (market research)")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return nil, err
	}
	var env struct {
		Data  []item `json:"data"`
		Error string `json:"error"`
	}
	_ = json.Unmarshal(b, &env)
	switch {
	case resp.StatusCode == http.StatusTooManyRequests:
		return nil, ErrRateLimited
	case resp.StatusCode == http.StatusUnprocessableEntity && strings.Contains(strings.ToLower(env.Error), "timeout"):
		return nil, errTimeout
	case resp.StatusCode != http.StatusOK:
		return nil, fmt.Errorf("reddit: %s r/%s: status %d %s", kind, sub, resp.StatusCode, env.Error)
	}
	out := make([]model.Discussion, 0, len(env.Data))
	for _, it := range env.Data {
		d := model.Discussion{ID: it.ID, Kind: kind, Subreddit: it.Subreddit, Score: it.Score, Date: dateOf(it.CreatedUTC)}
		if d.Subreddit == "" {
			d.Subreddit = sub
		}
		if kind == "post" {
			d.Title = clean(it.Title)
			d.Text = clean(it.Selftext)
			d.NumComments = it.NumComments
			d.URL = fmt.Sprintf("https://www.reddit.com/r/%s/comments/%s/", d.Subreddit, it.ID)
			if d.Title == "" {
				continue
			}
		} else {
			d.Text = clean(it.Body)
			d.URL = fmt.Sprintf("https://www.reddit.com/r/%s/comments/%s/_/%s/", d.Subreddit, strings.TrimPrefix(it.LinkID, "t3_"), it.ID)
			if len(d.Text) < 30 { // "this", "+1", removed comments
				continue
			}
		}
		out = append(out, d)
	}
	return out, nil
}

func dateOf(n json.Number) string {
	f, err := n.Float64()
	if err != nil || f <= 0 {
		return ""
	}
	return time.Unix(int64(f), 0).UTC().Format("2006-01-02")
}

// clean unescapes HTML entities, drops zero-width characters and removed/deleted markers.
func clean(s string) string {
	s = html.UnescapeString(s)
	s = strings.NewReplacer("\u200b", "", "\ufeff", "").Replace(s)
	s = strings.Join(strings.Fields(s), " ")
	if s == "[removed]" || s == "[deleted]" {
		return ""
	}
	return s
}
