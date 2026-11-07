// Package model holds domain types shared across packages.
package model

import "time"

// Data source of a market snapshot or trend series.
const (
	SourceLive  = "live"
	SourceCache = "cache"
	SourceSeed  = "seed"
)

// Product is a competitor listing found on eMAG.
type Product struct {
	ID          string  `json:"id"` // eMAG PNK (e.g. DP3CD3MBM)
	Title       string  `json:"title"`
	URL         string  `json:"url"`
	ImageURL    string  `json:"image_url,omitempty"`
	Category    string  `json:"category,omitempty"`
	Brand       string  `json:"brand,omitempty"`
	Seller      string  `json:"seller,omitempty"` // empty when the product page was not fetched
	Price       float64 `json:"price"`            // RON, VAT included
	Rating      float64 `json:"rating"`           // 0-5
	ReviewCount int     `json:"review_count"`
	Position    int     `json:"position"` // position in search results (1-based)
}

// Review is a customer review of a competitor product.
type Review struct {
	ProductID string `json:"product_id"`
	Rating    int    `json:"rating"`
	Text      string `json:"text"`
	Date      string `json:"date,omitempty"`
}

// MarketSnapshot is everything collected about one keyword on eMAG.
type MarketSnapshot struct {
	Keyword      string    `json:"keyword"`
	Source       string    `json:"source"`
	FetchedAt    time.Time `json:"fetched_at"`
	PagesFetched int       `json:"pages_fetched"`
	Products     []Product `json:"products"`
	Reviews      []Review  `json:"reviews"`
	FallbackNote string    `json:"fallback_note,omitempty"`
}

// TrendPoint is one Google Trends data point (0-100 relative interest).
type TrendPoint struct {
	Date  string `json:"date"` // YYYY-MM-DD (start of week)
	Value int    `json:"value"`
}

// TrendSeries is a Google Trends time series for a keyword.
type TrendSeries struct {
	Keyword      string       `json:"keyword"`
	Geo          string       `json:"geo"`
	Source       string       `json:"source"`
	FetchedAt    time.Time    `json:"fetched_at"`
	Points       []TrendPoint `json:"points"`
	FallbackNote string       `json:"fallback_note,omitempty"`
}

// Web data sources besides eMAG and Google Trends.
const (
	WebAmazon   = "amazon"
	WebReddit   = "reddit"
	WebBetaList = "betalist"
)

// Status of one web source in a WebSnapshot.
const (
	WebStatusOK       = "ok"       // data returned
	WebStatusEmpty    = "empty"    // the source answered but had nothing for the query
	WebStatusBlocked  = "blocked"  // bot challenge / rate limit; skipped without retrying
	WebStatusError    = "error"    // network or parse error
	WebStatusDisabled = "disabled" // turned off in config
)

// WebProduct is a listing found on an international marketplace (Amazon).
type WebProduct struct {
	ID          string  `json:"id"` // ASIN
	Title       string  `json:"title"`
	URL         string  `json:"url"`
	ImageURL    string  `json:"image_url,omitempty"`
	Price       float64 `json:"price"`    // in Currency; 0 when not shown
	Currency    string  `json:"currency"` // EUR | USD | GBP
	Rating      float64 `json:"rating"`   // 0-5
	ReviewCount int     `json:"review_count"`
	Sponsored   bool    `json:"sponsored"`
	Position    int     `json:"position"` // 1-based, in search results
}

// Discussion is a Reddit post or comment that mentions the query.
type Discussion struct {
	ID          string `json:"id"`
	Kind        string `json:"kind"` // post | comment
	Subreddit   string `json:"subreddit"`
	Title       string `json:"title,omitempty"` // posts only
	Text        string `json:"text"`
	URL         string `json:"url"`
	Score       int    `json:"score"`
	NumComments int    `json:"num_comments"` // posts only
	Date        string `json:"date"`         // YYYY-MM-DD
}

// Launch is a startup / new product listed on a launch site (BetaList).
type Launch struct {
	ID       string `json:"id"` // slug
	Name     string `json:"name"`
	Tagline  string `json:"tagline"`
	URL      string `json:"url"`
	ImageURL string `json:"image_url,omitempty"`
}

// WebSourceStatus reports what happened with one web source.
type WebSourceStatus struct {
	Name   string `json:"name"`   // amazon | reddit | betalist
	Status string `json:"status"` // ok | empty | blocked | error | disabled
	Items  int    `json:"items"`
	Note   string `json:"note,omitempty"` // Romanian, shown to the seller when not ok
}

// WebSnapshot is everything collected about a product outside eMAG.
type WebSnapshot struct {
	Query        string            `json:"query"` // English search term
	Subreddits   []string          `json:"subreddits"`
	Source       string            `json:"source"` // live | cache
	FetchedAt    time.Time         `json:"fetched_at"`
	PagesFetched int               `json:"pages_fetched"`
	Sources      []WebSourceStatus `json:"sources"`
	Amazon       []WebProduct      `json:"amazon"`
	Discussions  []Discussion      `json:"discussions"`
	Launches     []Launch          `json:"launches"`
}
