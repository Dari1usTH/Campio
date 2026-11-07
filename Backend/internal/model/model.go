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
