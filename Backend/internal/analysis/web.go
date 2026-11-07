package analysis

import (
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/tibi/hackathon/backend/internal/model"
)

// Fixed exchange rates used to compare foreign marketplace prices with eMAG (approximate).
const (
	EURToRON = 5.0
	GBPToRON = 5.8
)

// ToRON converts an amount to RON with the fixed rates; ok is false for unknown currencies.
func ToRON(amount float64, currency string) (float64, bool) {
	switch currency {
	case "RON":
		return amount, true
	case "EUR":
		return amount * EURToRON, true
	case "USD":
		return amount * USDToRON, true
	case "GBP":
		return amount * GBPToRON, true
	}
	return 0, false
}

// AmazonStats summarises the Amazon search results.
type AmazonStats struct {
	ProductCount   int     `json:"product_count"`
	PricedCount    int     `json:"priced_count"` // products whose price is in Currency
	Currency       string  `json:"currency"`
	PriceMin       float64 `json:"price_min"` // in Currency
	PriceMedian    float64 `json:"price_median"`
	PriceMax       float64 `json:"price_max"`
	PriceMedianRON float64 `json:"price_median_ron"`
	AvgRating      float64 `json:"avg_rating"` // weighted by review count
	TotalReviews   int     `json:"total_reviews"`
	SponsoredPct   float64 `json:"sponsored_pct"`
	// EmagVsAmazonPct is the eMAG median price vs the Amazon median in RON, % (+ = eMAG more expensive). 0 when unknown.
	EmagVsAmazonPct float64 `json:"emag_vs_amazon_pct"`
}

// SubredditStat counts matching Reddit content in one subreddit.
type SubredditStat struct {
	Name     string `json:"name"`
	Posts    int    `json:"posts"`
	Comments int    `json:"comments"`
	Score    int    `json:"score"`
}

// RedditStats summarises the Reddit discussions.
type RedditStats struct {
	PostCount     int             `json:"post_count"`
	CommentCount  int             `json:"comment_count"`
	TotalScore    int             `json:"total_score"`
	TotalReplies  int             `json:"total_replies"`  // sum of num_comments of matching posts
	Last12Months  int             `json:"last_12_months"` // posts + comments in the 12 months before the fetch
	Last12MonthsP float64         `json:"last_12_months_pct"`
	FirstDate     string          `json:"first_date,omitempty"`
	LastDate      string          `json:"last_date,omitempty"`
	Subreddits    []SubredditStat `json:"subreddits"`
}

// LaunchStats summarises launch-site results after the relevance filter.
type LaunchStats struct {
	Found    int `json:"found"`    // returned by the site's search
	Relevant int `json:"relevant"` // name or tagline mentions the query
}

// WebStats are the computed numbers for the non-eMAG sources.
type WebStats struct {
	Amazon   AmazonStats `json:"amazon"`
	Reddit   RedditStats `json:"reddit"`
	Launches LaunchStats `json:"launches"`
}

// ComputeWeb derives statistics from a web snapshot. emagMedianRON may be 0.
func ComputeWeb(w model.WebSnapshot, emagMedianRON float64) WebStats {
	return WebStats{
		Amazon:   computeAmazon(w.Amazon, emagMedianRON),
		Reddit:   computeReddit(w.Discussions, w.FetchedAt),
		Launches: LaunchStats{Found: len(w.Launches), Relevant: len(RelevantLaunches(w.Launches, w.Query))},
	}
}

func computeAmazon(ps []model.WebProduct, emagMedianRON float64) AmazonStats {
	a := AmazonStats{ProductCount: len(ps)}
	if len(ps) == 0 {
		return a
	}
	// Use the most common currency; ignore prices in any other.
	byCur := map[string]int{}
	for _, p := range ps {
		if p.Price > 0 {
			byCur[p.Currency]++
		}
	}
	for c, n := range byCur {
		if n > byCur[a.Currency] || (n == byCur[a.Currency] && c < a.Currency) {
			a.Currency = c
		}
	}
	var prices []float64
	var ratingW, weight float64
	sponsored := 0
	for _, p := range ps {
		if p.Price > 0 && p.Currency == a.Currency {
			prices = append(prices, p.Price)
		}
		a.TotalReviews += p.ReviewCount
		if p.Rating > 0 && p.ReviewCount > 0 {
			ratingW += p.Rating * float64(p.ReviewCount)
			weight += float64(p.ReviewCount)
		}
		if p.Sponsored {
			sponsored++
		}
	}
	a.SponsoredPct = Round2(float64(sponsored) / float64(len(ps)) * 100)
	if weight > 0 {
		a.AvgRating = Round2(ratingW / weight)
	}
	a.PricedCount = len(prices)
	if len(prices) > 0 {
		sort.Float64s(prices)
		a.PriceMin, a.PriceMax = Round2(prices[0]), Round2(prices[len(prices)-1])
		a.PriceMedian = Round2(percentile(prices, 50))
		if ron, ok := ToRON(a.PriceMedian, a.Currency); ok {
			a.PriceMedianRON = Round2(ron)
			if emagMedianRON > 0 && ron > 0 {
				a.EmagVsAmazonPct = Round2((emagMedianRON/ron - 1) * 100)
			}
		}
	}
	return a
}

func computeReddit(ds []model.Discussion, fetched time.Time) RedditStats {
	r := RedditStats{Subreddits: []SubredditStat{}}
	if len(ds) == 0 {
		return r
	}
	cutoff := ""
	if !fetched.IsZero() {
		cutoff = fetched.AddDate(-1, 0, 0).Format("2006-01-02")
	}
	subs := map[string]*SubredditStat{}
	for _, d := range ds {
		key := strings.ToLower(d.Subreddit)
		s := subs[key]
		if s == nil {
			s = &SubredditStat{Name: d.Subreddit}
			subs[key] = s
		}
		if d.Kind == "post" {
			r.PostCount++
			s.Posts++
			r.TotalReplies += d.NumComments
		} else {
			r.CommentCount++
			s.Comments++
		}
		r.TotalScore += d.Score
		s.Score += d.Score
		if d.Date != "" {
			if r.FirstDate == "" || d.Date < r.FirstDate {
				r.FirstDate = d.Date
			}
			if d.Date > r.LastDate {
				r.LastDate = d.Date
			}
			if cutoff != "" && d.Date >= cutoff {
				r.Last12Months++
			}
		}
	}
	r.Last12MonthsP = Round2(float64(r.Last12Months) / float64(len(ds)) * 100)
	for _, s := range subs {
		r.Subreddits = append(r.Subreddits, *s)
	}
	sort.Slice(r.Subreddits, func(i, j int) bool {
		a, b := r.Subreddits[i], r.Subreddits[j]
		if a.Posts+a.Comments != b.Posts+b.Comments {
			return a.Posts+a.Comments > b.Posts+b.Comments
		}
		return a.Name < b.Name
	})
	return r
}

var stopwords = map[string]bool{"the": true, "and": true, "for": true, "with": true, "pentru": true, "din": true, "cu": true}

func words(s string) []string {
	return strings.FieldsFunc(strings.ToLower(s), func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsDigit(r) })
}

// Relevant reports whether text mentions any meaningful word of query
// (prefix match both ways, so "laptop" ~ "laptops" and "stand" ~ "standing").
func Relevant(text, query string) bool {
	tw := words(text)
	for _, q := range words(query) {
		if len(q) < 3 || stopwords[q] {
			continue
		}
		for _, w := range tw {
			if strings.HasPrefix(w, q) || (len(w) >= 4 && strings.HasPrefix(q, w)) {
				return true
			}
		}
	}
	return false
}

// RelevantLaunches keeps launches whose name or tagline mentions the query.
func RelevantLaunches(ls []model.Launch, query string) []model.Launch {
	out := []model.Launch{}
	for _, l := range ls {
		if Relevant(l.Name+" "+l.Tagline, query) {
			out = append(out, l)
		}
	}
	return out
}
