// Package emag scrapes public eMAG search and product pages.
//
// All selectors live in this file. Verified against live markup on 2026-11-07:
//   - search cards:  div.card-item.js-product-data[data-product-id] with data-name / data-url
//   - price:         p.product-new-price  ("1.299<sup>,99</sup> Lei")
//   - rating:        span.average-rating  ("4.44"), review count: .star-rating-text .visible-xs-inline-block ("(382)")
//   - product page:  <script type="application/ld+json"> Product with offers.seller.name, brand, review[]
package emag

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"

	"github.com/tibi/hackathon/backend/internal/model"
)

const (
	baseURL   = "https://www.emag.ro"
	userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)

// ErrNoResults is returned when the search page has no product cards
// (no results, captcha, or changed markup).
var ErrNoResults = errors.New("emag: no products found on search page")

// Scraper fetches eMAG pages.
type Scraper struct {
	client       *http.Client
	DetailPages  int // how many product pages to open for seller + reviews
	Concurrency  int
	RequestDelay time.Duration
}

// New returns a scraper with sensible defaults.
func New() *Scraper {
	return &Scraper{
		client:       &http.Client{Timeout: 15 * time.Second},
		DetailPages:  8,
		Concurrency:  3,
		RequestDelay: 250 * time.Millisecond,
	}
}

// Scrape searches eMAG for keyword and enriches the top products with seller and reviews.
func (s *Scraper) Scrape(ctx context.Context, keyword string) (model.MarketSnapshot, error) {
	snap := model.MarketSnapshot{Keyword: keyword, Source: model.SourceLive, FetchedAt: time.Now().UTC()}

	products, err := s.Search(ctx, keyword)
	snap.PagesFetched++
	if err != nil {
		return snap, err
	}

	// Open the most-reviewed listings: they carry the most signal about complaints and sellers.
	idx := make([]int, len(products))
	for i := range idx {
		idx[i] = i
	}
	sort.SliceStable(idx, func(a, b int) bool { return products[idx[a]].ReviewCount > products[idx[b]].ReviewCount })
	if len(idx) > s.DetailPages {
		idx = idx[:s.DetailPages]
	}

	var (
		mu      sync.Mutex
		wg      sync.WaitGroup
		sem     = make(chan struct{}, max(1, s.Concurrency))
		reviews []model.Review
	)
	for _, i := range idx {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			select {
			case <-ctx.Done():
				return
			case <-time.After(s.RequestDelay):
			}
			d, err := s.Product(ctx, products[i].URL)
			mu.Lock()
			defer mu.Unlock()
			snap.PagesFetched++
			if err != nil {
				return
			}
			products[i].Seller = d.Seller
			if products[i].Brand == "" {
				products[i].Brand = d.Brand
			}
			for _, r := range d.Reviews {
				r.ProductID = products[i].ID
				reviews = append(reviews, r)
			}
		}(i)
	}
	wg.Wait()

	snap.Products = products
	snap.Reviews = reviews
	if snap.Reviews == nil {
		snap.Reviews = []model.Review{}
	}
	return snap, nil
}

// Search parses the first search results page.
func (s *Scraper) Search(ctx context.Context, keyword string) ([]model.Product, error) {
	u := fmt.Sprintf("%s/search/%s", baseURL, url.PathEscape(strings.TrimSpace(keyword)))
	body, err := s.get(ctx, u)
	if err != nil {
		return nil, err
	}
	defer body.Close()
	doc, err := goquery.NewDocumentFromReader(body)
	if err != nil {
		return nil, err
	}
	var out []model.Product
	seen := map[string]bool{}
	doc.Find("div.card-item.js-product-data[data-product-id]").Each(func(_ int, card *goquery.Selection) {
		p := model.Product{
			Title:    strings.TrimSpace(card.AttrOr("data-name", "")),
			URL:      card.AttrOr("data-url", ""),
			Category: card.AttrOr("data-category-name", ""),
		}
		p.ID = pnkFromURL(p.URL)
		if p.ID == "" {
			p.ID = card.AttrOr("data-product-id", "")
		}
		if p.Title == "" || p.ID == "" || seen[p.ID] {
			return
		}
		seen[p.ID] = true
		p.Price = parsePrice(card.Find("p.product-new-price").First().Text())
		p.Rating, _ = strconv.ParseFloat(strings.TrimSpace(card.Find("span.average-rating").First().Text()), 64)
		p.ReviewCount = parseInt(card.Find(".star-rating-text .visible-xs-inline-block").First().Text())
		if img, ok := card.Find(".card-v2-thumb img").First().Attr("src"); ok {
			p.ImageURL = img
		}
		p.Position = len(out) + 1
		out = append(out, p)
	})
	if len(out) == 0 {
		return nil, ErrNoResults
	}
	return out, nil
}

// ProductDetails is what we extract from a product page.
type ProductDetails struct {
	Seller  string
	Brand   string
	Reviews []model.Review
}

var ldJSONRe = regexp.MustCompile(`(?s)<script type="application/ld\+json">(.*?)</script>`)
var ctrlRe = regexp.MustCompile(`[\x00-\x1f]`)

// Product parses the JSON-LD block of a product page.
func (s *Scraper) Product(ctx context.Context, productURL string) (ProductDetails, error) {
	var d ProductDetails
	body, err := s.get(ctx, productURL)
	if err != nil {
		return d, err
	}
	defer body.Close()
	raw, err := io.ReadAll(io.LimitReader(body, 8<<20))
	if err != nil {
		return d, err
	}
	for _, m := range ldJSONRe.FindAllSubmatch(raw, -1) {
		// eMAG embeds raw newlines inside JSON strings; replace control chars.
		clean := ctrlRe.ReplaceAll(m[1], []byte(" "))
		var ld struct {
			Type   string                `json:"@type"`
			Brand  struct{ Name string } `json:"brand"`
			Offers json.RawMessage       `json:"offers"`
			Review []struct {
				ReviewRating struct {
					RatingValue json.Number `json:"ratingValue"`
				} `json:"reviewRating"`
				ReviewBody    string `json:"reviewBody"`
				DatePublished string `json:"datePublished"`
			} `json:"review"`
		}
		if json.Unmarshal(clean, &ld) != nil || ld.Type != "Product" {
			continue
		}
		d.Brand = ld.Brand.Name
		d.Seller = sellerFromOffers(ld.Offers)
		for _, r := range ld.Review {
			text := strings.TrimSpace(r.ReviewBody)
			if text == "" {
				continue
			}
			rating, _ := r.ReviewRating.RatingValue.Float64()
			date := r.DatePublished
			if len(date) >= 10 {
				date = date[:10]
			}
			d.Reviews = append(d.Reviews, model.Review{Rating: int(rating), Text: text, Date: date})
		}
		return d, nil
	}
	return d, errors.New("emag: product JSON-LD not found")
}

func sellerFromOffers(raw json.RawMessage) string {
	type offer struct {
		Seller struct{ Name string } `json:"seller"`
	}
	var one offer
	if json.Unmarshal(raw, &one) == nil && one.Seller.Name != "" {
		return one.Seller.Name
	}
	var many []offer
	if json.Unmarshal(raw, &many) == nil {
		for _, o := range many {
			if o.Seller.Name != "" {
				return o.Seller.Name
			}
		}
	}
	return ""
}

func (s *Scraper) get(ctx context.Context, u string) (io.ReadCloser, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml")
	req.Header.Set("Accept-Language", "ro-RO,ro;q=0.9,en;q=0.5")
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("emag: GET %s: status %d", u, resp.StatusCode)
	}
	return resp.Body, nil
}

var pnkRe = regexp.MustCompile(`/pd/([A-Z0-9]+)/?`)
var numRe = regexp.MustCompile(`[0-9][0-9.]*(,[0-9]+)?`)
var intRe = regexp.MustCompile(`[0-9]+`)

func pnkFromURL(u string) string {
	if m := pnkRe.FindStringSubmatch(u); m != nil {
		return m[1]
	}
	return ""
}

// parsePrice turns "1.299,99 Lei" into 1299.99.
func parsePrice(s string) float64 {
	m := numRe.FindString(strings.ReplaceAll(s, " ", " "))
	if m == "" {
		return 0
	}
	m = strings.ReplaceAll(m, ".", "")
	m = strings.ReplaceAll(m, ",", ".")
	v, _ := strconv.ParseFloat(m, 64)
	return v
}

func parseInt(s string) int {
	v, _ := strconv.Atoi(intRe.FindString(s))
	return v
}
