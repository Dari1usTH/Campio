// Package amazon reads one public Amazon search results page (best effort).
//
// Amazon has no free product API and protects search with a bot challenge. This
// package makes a single ordinary request per query; when Amazon answers with a
// challenge or captcha it returns ErrBlocked and the caller skips the source.
// It never retries or tries to get around the challenge.
//
// Selectors (standard Amazon search markup):
//   - card:    div[data-component-type="s-search-result"][data-asin]
//   - title:   h2 (text, or its aria-label)
//   - price:   span.a-price:not(.a-text-price) span.a-offscreen  ("29,99 €" / "€29.99" / "RON 125.85":
//     Amazon converts to the visitor's local currency, verified 2026-11-07 from Romania)
//   - rating:  span.a-icon-alt                                  ("4,5 von 5 Sternen" / "4.5 out of 5 stars")
//   - reviews: a[href*="customerReviews"] span, or its aria-label ("1.234" / "(1.2K)")
//   - ad:      .puis-sponsored-label-text / .s-sponsored-label-text
package amazon

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"

	"github.com/tibi/hackathon/backend/internal/model"
)

const userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

var (
	// ErrBlocked means Amazon answered with a bot challenge or captcha.
	ErrBlocked = errors.New("amazon: bot challenge, search skipped")
	// ErrNoResults means the page loaded but had no product cards.
	ErrNoResults = errors.New("amazon: no products found")
)

// Scraper fetches Amazon search pages.
type Scraper struct {
	BaseURL string // e.g. https://www.amazon.de
	client  *http.Client
}

// New returns a scraper for the given marketplace host (default www.amazon.de).
func New(domain string) *Scraper {
	if domain == "" {
		domain = "www.amazon.de"
	}
	return &Scraper{BaseURL: "https://" + strings.TrimPrefix(domain, "https://"), client: &http.Client{Timeout: 15 * time.Second}}
}

// Search returns the products on the first search results page for query.
func (s *Scraper) Search(ctx context.Context, query string) ([]model.WebProduct, error) {
	q := url.Values{"k": {strings.TrimSpace(query)}, "language": {"en_GB"}}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.BaseURL+"/s?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml")
	req.Header.Set("Accept-Language", "en-GB,en;q=0.9")
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return nil, err
	}
	switch {
	case resp.StatusCode == http.StatusServiceUnavailable || resp.StatusCode == http.StatusTooManyRequests:
		return nil, ErrBlocked
	case resp.StatusCode != http.StatusOK:
		return nil, fmt.Errorf("amazon: status %d", resp.StatusCode)
	}
	return Parse(string(body), s.BaseURL)
}

// Parse extracts products from a search results page.
func Parse(html, baseURL string) ([]model.WebProduct, error) {
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil, err
	}
	currency := currencyFor(baseURL)
	var out []model.WebProduct
	seen := map[string]bool{}
	doc.Find(`div[data-component-type="s-search-result"][data-asin]`).Each(func(_ int, card *goquery.Selection) {
		asin := strings.TrimSpace(card.AttrOr("data-asin", ""))
		h2 := card.Find("h2").First()
		title := strings.Join(strings.Fields(h2.Text()), " ")
		if title == "" {
			title = strings.TrimSpace(h2.AttrOr("aria-label", ""))
		}
		if asin == "" || title == "" || seen[asin] {
			return
		}
		seen[asin] = true
		p := model.WebProduct{ID: asin, Title: title, URL: baseURL + "/dp/" + asin, Currency: currency}
		priceText := card.Find("span.a-price:not(.a-text-price) span.a-offscreen").First().Text()
		p.Price = ParsePrice(priceText)
		if c := currencyFromText(priceText); c != "" {
			p.Currency = c
		}
		p.Rating = parseRating(card.Find("span.a-icon-alt").First().Text())
		rv := card.Find(`a[href*="customerReviews"]`).First()
		p.ReviewCount = ParseCount(rv.Find("span").First().Text())
		if p.ReviewCount == 0 {
			p.ReviewCount = ParseCount(rv.AttrOr("aria-label", ""))
		}
		p.Sponsored = card.Find(".puis-sponsored-label-text, .s-sponsored-label-text").Length() > 0
		p.ImageURL = card.Find("img.s-image").First().AttrOr("src", "")
		p.Position = len(out) + 1
		out = append(out, p)
	})
	if len(out) > 0 {
		return out, nil
	}
	lower := strings.ToLower(html)
	if strings.Contains(lower, "captcha") || strings.Contains(lower, "akam") || strings.Contains(lower, "robot check") || len(html) < 20000 {
		return nil, ErrBlocked
	}
	return nil, ErrNoResults
}

func currencyFor(baseURL string) string {
	switch {
	case strings.HasSuffix(baseURL, ".com"):
		return "USD"
	case strings.HasSuffix(baseURL, ".co.uk"):
		return "GBP"
	}
	return "EUR"
}

// currencyFromText reads the currency shown in a price. Amazon shows prices in the
// visitor's local currency (e.g. "RON 125.85" for visitors from Romania).
func currencyFromText(s string) string {
	u := strings.ToUpper(s)
	for _, code := range []string{"RON", "EUR", "USD", "GBP"} {
		if strings.Contains(u, code) {
			return code
		}
	}
	switch {
	case strings.Contains(u, "LEI"):
		return "RON"
	case strings.Contains(s, "€"):
		return "EUR"
	case strings.Contains(s, "£"):
		return "GBP"
	case strings.Contains(s, "$"):
		return "USD"
	}
	return ""
}

var numRe = regexp.MustCompile(`[0-9][0-9.,]*`)

// ParsePrice handles both "1.299,99 €" and "€1,299.99": the last separator
// followed by exactly two digits is the decimal point.
func ParsePrice(s string) float64 {
	m := numRe.FindString(strings.ReplaceAll(s, " ", " "))
	if m == "" {
		return 0
	}
	dec := ""
	if i := strings.LastIndexAny(m, ".,"); i >= 0 && len(m)-i-1 == 2 {
		m, dec = m[:i], m[i+1:]
	}
	m = strings.NewReplacer(".", "", ",", "").Replace(m)
	if dec != "" {
		m += "." + dec
	}
	v, _ := strconv.ParseFloat(m, 64)
	return v
}

var ratingRe = regexp.MustCompile(`[0-9]+([.,][0-9])?`)

func parseRating(s string) float64 {
	v, _ := strconv.ParseFloat(strings.ReplaceAll(ratingRe.FindString(s), ",", "."), 64)
	if v > 5 {
		return 0
	}
	return v
}

var countRe = regexp.MustCompile(`([0-9][0-9.,]*)\s*([KkMm]?)`)

// ParseCount turns "1.234", "(1,234)", "1.2K" or "12,345 ratings" into an integer.
func ParseCount(s string) int {
	m := countRe.FindStringSubmatch(s)
	if m == nil {
		return 0
	}
	num, suffix := m[1], strings.ToUpper(m[2])
	if suffix != "" {
		v, _ := strconv.ParseFloat(strings.ReplaceAll(num, ",", "."), 64)
		mult := 1000.0
		if suffix == "M" {
			mult = 1e6
		}
		return int(v * mult)
	}
	v, _ := strconv.Atoi(strings.NewReplacer(".", "", ",", "").Replace(num))
	return v
}
