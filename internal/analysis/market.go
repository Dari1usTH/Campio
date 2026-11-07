// Package analysis holds every deterministic calculation: market statistics,
// budget allocation, reach estimates, A/B test sizing and cost accounting.
// The AI never produces these numbers; it only chooses strategy and words.
package analysis

import (
	"math"
	"sort"
	"strconv"

	"github.com/tibi/hackathon/backend/internal/model"
)

// Market-size model constants.
const (
	// ReviewRate is the share of buyers who leave a review on eMAG.
	ReviewRate = 0.02
	// ReviewLifetimeMonths is the assumed average age of the reviews on a listing.
	ReviewLifetimeMonths = 24.0
)

// SellerStat aggregates competitor listings per seller.
type SellerStat struct {
	Name           string  `json:"name"`
	ProductCount   int     `json:"product_count"`
	ReviewCount    int     `json:"review_count"`
	ReviewSharePct float64 `json:"review_share_pct"`
}

// PriceBucket is one bar of the competitor price histogram.
type PriceBucket struct {
	From  float64 `json:"from"`
	To    float64 `json:"to"`
	Count int     `json:"count"`
}

// MarketStats summarises the competition on eMAG.
type MarketStats struct {
	CompetitorCount     int           `json:"competitor_count"`
	KnownSellerCount    int           `json:"known_seller_count"`
	PriceMin            float64       `json:"price_min"`
	PriceP25            float64       `json:"price_p25"`
	PriceMedian         float64       `json:"price_median"`
	PriceP75            float64       `json:"price_p75"`
	PriceMax            float64       `json:"price_max"`
	PriceAvg            float64       `json:"price_avg"`
	AvgRating           float64       `json:"avg_rating"`
	TotalReviews        int           `json:"total_reviews"`
	Top3ReviewSharePct  float64       `json:"top3_review_share_pct"`
	EstMarketUnitsMonth float64       `json:"est_market_units_month"`
	TopSellers          []SellerStat  `json:"top_sellers"`
	PriceHistogram      []PriceBucket `json:"price_histogram"`
}

// YearAvg is the average Google Trends interest for a calendar year.
type YearAvg struct {
	Year  int     `json:"year"`
	Value float64 `json:"value"`
}

// TrendStats summarises the Google Trends series.
type TrendStats struct {
	Direction      string    `json:"direction"` // rising | stable | declining | unknown
	YoYChangePct   float64   `json:"yoy_change_pct"`
	Last12MonthAvg float64   `json:"last_12_month_avg"`
	Prev12MonthAvg float64   `json:"prev_12_month_avg"`
	PeakMonth      string    `json:"peak_month,omitempty"`
	Yearly         []YearAvg `json:"yearly"`
}

// ComputeMarket derives competition statistics from the scraped products.
func ComputeMarket(snap model.MarketSnapshot) MarketStats {
	ps := snap.Products
	m := MarketStats{CompetitorCount: len(ps), TopSellers: []SellerStat{}, PriceHistogram: []PriceBucket{}}
	if len(ps) == 0 {
		return m
	}
	prices := make([]float64, 0, len(ps))
	reviews := make([]int, 0, len(ps))
	var ratingWeighted, ratingWeight, sum float64
	sellers := map[string]*SellerStat{}
	for _, p := range ps {
		if p.Price > 0 {
			prices = append(prices, p.Price)
			sum += p.Price
		}
		reviews = append(reviews, p.ReviewCount)
		m.TotalReviews += p.ReviewCount
		if p.Rating > 0 && p.ReviewCount > 0 {
			ratingWeighted += p.Rating * float64(p.ReviewCount)
			ratingWeight += float64(p.ReviewCount)
		}
		if p.Seller != "" {
			s := sellers[p.Seller]
			if s == nil {
				s = &SellerStat{Name: p.Seller}
				sellers[p.Seller] = s
			}
			s.ProductCount++
			s.ReviewCount += p.ReviewCount
		}
	}
	sort.Float64s(prices)
	if len(prices) > 0 {
		m.PriceMin = Round2(prices[0])
		m.PriceMax = Round2(prices[len(prices)-1])
		m.PriceP25 = Round2(percentile(prices, 25))
		m.PriceMedian = Round2(percentile(prices, 50))
		m.PriceP75 = Round2(percentile(prices, 75))
		m.PriceAvg = Round2(sum / float64(len(prices)))
		m.PriceHistogram = histogram(prices, 8)
	}
	if ratingWeight > 0 {
		m.AvgRating = Round2(ratingWeighted / ratingWeight)
	}
	sort.Sort(sort.Reverse(sort.IntSlice(reviews)))
	if m.TotalReviews > 0 {
		top := 0
		for i := 0; i < len(reviews) && i < 3; i++ {
			top += reviews[i]
		}
		m.Top3ReviewSharePct = Round2(float64(top) / float64(m.TotalReviews) * 100)
	}
	m.KnownSellerCount = len(sellers)
	for _, s := range sellers {
		if m.TotalReviews > 0 {
			s.ReviewSharePct = Round2(float64(s.ReviewCount) / float64(m.TotalReviews) * 100)
		}
		m.TopSellers = append(m.TopSellers, *s)
	}
	sort.Slice(m.TopSellers, func(i, j int) bool {
		if m.TopSellers[i].ReviewCount != m.TopSellers[j].ReviewCount {
			return m.TopSellers[i].ReviewCount > m.TopSellers[j].ReviewCount
		}
		return m.TopSellers[i].Name < m.TopSellers[j].Name
	})
	if len(m.TopSellers) > 5 {
		m.TopSellers = m.TopSellers[:5]
	}
	m.EstMarketUnitsMonth = Round2(float64(m.TotalReviews) / ReviewLifetimeMonths / ReviewRate)
	return m
}

// ComputeTrend summarises a Google Trends series (weekly points expected).
func ComputeTrend(ts model.TrendSeries) TrendStats {
	t := TrendStats{Direction: "unknown", Yearly: []YearAvg{}}
	pts := ts.Points
	if len(pts) == 0 {
		return t
	}
	const perYear = 52
	n := len(pts)
	last := avgPoints(pts[max(0, n-perYear):])
	prev := 0.0
	if n > perYear {
		prev = avgPoints(pts[max(0, n-2*perYear) : n-perYear])
	}
	t.Last12MonthAvg = Round2(last)
	t.Prev12MonthAvg = Round2(prev)
	if prev > 0 {
		t.YoYChangePct = Round2((last - prev) / prev * 100)
		switch {
		case t.YoYChangePct > 10:
			t.Direction = "rising"
		case t.YoYChangePct < -10:
			t.Direction = "declining"
		default:
			t.Direction = "stable"
		}
	}
	years := map[int][2]float64{}
	months := map[string][2]float64{}
	for _, p := range pts {
		if len(p.Date) < 7 {
			continue
		}
		y, err := strconv.Atoi(p.Date[:4])
		if err != nil {
			continue
		}
		a := years[y]
		years[y] = [2]float64{a[0] + float64(p.Value), a[1] + 1}
		mo := p.Date[5:7]
		b := months[mo]
		months[mo] = [2]float64{b[0] + float64(p.Value), b[1] + 1}
	}
	for y, a := range years {
		t.Yearly = append(t.Yearly, YearAvg{Year: y, Value: Round2(a[0] / a[1])})
	}
	sort.Slice(t.Yearly, func(i, j int) bool { return t.Yearly[i].Year < t.Yearly[j].Year })
	best := -1.0
	keys := make([]string, 0, len(months))
	for k := range months {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		if v := months[k][0] / months[k][1]; v > best {
			best, t.PeakMonth = v, k
		}
	}
	return t
}

func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	if len(sorted) == 1 {
		return sorted[0]
	}
	pos := p / 100 * float64(len(sorted)-1)
	lo := int(math.Floor(pos))
	hi := int(math.Ceil(pos))
	return sorted[lo] + (sorted[hi]-sorted[lo])*(pos-float64(lo))
}

func histogram(sorted []float64, buckets int) []PriceBucket {
	lo, hi := sorted[0], sorted[len(sorted)-1]
	if hi == lo {
		return []PriceBucket{{From: Round2(lo), To: Round2(hi), Count: len(sorted)}}
	}
	w := (hi - lo) / float64(buckets)
	out := make([]PriceBucket, buckets)
	for i := range out {
		out[i] = PriceBucket{From: Round2(lo + w*float64(i)), To: Round2(lo + w*float64(i+1))}
	}
	for _, v := range sorted {
		i := int((v - lo) / w)
		if i >= buckets {
			i = buckets - 1
		}
		out[i].Count++
	}
	return out
}

func avgPoints(pts []model.TrendPoint) float64 {
	if len(pts) == 0 {
		return 0
	}
	s := 0
	for _, p := range pts {
		s += p.Value
	}
	return float64(s) / float64(len(pts))
}

// Round2 rounds to 2 decimals.
func Round2(v float64) float64 { return math.Round(v*100) / 100 }

// Round6 rounds to 6 decimals (USD costs).
func Round6(v float64) float64 { return math.Round(v*1e6) / 1e6 }
