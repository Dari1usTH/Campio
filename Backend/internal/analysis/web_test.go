package analysis

import (
	"testing"
	"time"

	"github.com/tibi/hackathon/backend/internal/model"
)

func TestComputeWeb(t *testing.T) {
	w := model.WebSnapshot{
		Query:     "laptop stand",
		FetchedAt: time.Date(2026, 11, 7, 0, 0, 0, 0, time.UTC),
		Amazon: []model.WebProduct{
			{ID: "a", Price: 20, Currency: "EUR", Rating: 4, ReviewCount: 100, Sponsored: true},
			{ID: "b", Price: 30, Currency: "EUR", Rating: 5, ReviewCount: 300},
			{ID: "c", Price: 40, Currency: "EUR"},
			{ID: "d", Price: 99, Currency: "USD"}, // minority currency: ignored for prices
		},
		Discussions: []model.Discussion{
			{Kind: "post", Subreddit: "laptops", Score: 5, NumComments: 3, Date: "2026-10-01"},
			{Kind: "comment", Subreddit: "Laptops", Score: 2, Date: "2025-01-01"},
			{Kind: "comment", Subreddit: "ergonomics", Score: 1, Date: "2026-11-06"},
		},
		Launches: []model.Launch{
			{Name: "Borrowist", Tagline: "Manage lending money between friends"},
			{Name: "Slidenjoy", Tagline: "Accessory tripling your laptop screen"},
			{Name: "Standly", Tagline: "Standing desk reminders"},
		},
	}
	s := ComputeWeb(w, 200)

	a := s.Amazon
	if a.ProductCount != 4 || a.PricedCount != 3 || a.Currency != "EUR" || a.PriceMin != 20 || a.PriceMedian != 30 || a.PriceMax != 40 ||
		a.PriceMedianRON != 150 || a.AvgRating != 4.75 || a.TotalReviews != 400 || a.SponsoredPct != 25 || !near(a.EmagVsAmazonPct, 33.33, 0.01) {
		t.Fatalf("amazon stats wrong: %+v", a)
	}
	r := s.Reddit
	if r.PostCount != 1 || r.CommentCount != 2 || r.TotalScore != 8 || r.TotalReplies != 3 || r.Last12Months != 2 ||
		r.FirstDate != "2025-01-01" || r.LastDate != "2026-11-06" || len(r.Subreddits) != 2 ||
		r.Subreddits[0].Name != "laptops" || r.Subreddits[0].Posts != 1 || r.Subreddits[0].Comments != 1 {
		t.Fatalf("reddit stats wrong: %+v", r)
	}
	if s.Launches.Found != 3 || s.Launches.Relevant != 2 {
		t.Fatalf("launch stats wrong: %+v", s.Launches)
	}
}

func TestComputeWebEmpty(t *testing.T) {
	s := ComputeWeb(model.WebSnapshot{}, 0)
	if s.Amazon.ProductCount != 0 || s.Reddit.Subreddits == nil || s.Launches.Relevant != 0 {
		t.Fatalf("empty stats wrong: %+v", s)
	}
}
