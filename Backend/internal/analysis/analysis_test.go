package analysis

import (
	"math"
	"testing"

	"github.com/tibi/hackathon/backend/internal/model"
)

func near(a, b, tol float64) bool { return math.Abs(a-b) <= tol }

func TestAllocateBudgetNormalisesShares(t *testing.T) {
	plans, tot := AllocateBudget(1000, 50, map[string]float64{ChannelMeta: 30, ChannelTikTok: 10, "bogus": 50, ChannelEmagAds: -5})
	if len(plans) != 2 {
		t.Fatalf("expected 2 channels, got %+v", plans)
	}
	if plans[0].Channel != ChannelMeta || plans[0].SharePct != 75 || plans[0].BudgetRON != 750 || plans[0].WeeklyBudgetRON != 187.5 {
		t.Fatalf("meta plan wrong: %+v", plans[0])
	}
	// meta: 750 lei / 12 CPM → 62 500 impressions → 625 clicks → 7.5 orders → 375 lei
	if plans[0].EstImpressions != 62500 || plans[0].EstClicks != 625 || plans[0].EstOrders != 7.5 || plans[0].EstRevenueRON != 375 {
		t.Fatalf("meta estimates wrong: %+v", plans[0])
	}
	if tot.BudgetRON != 1000 {
		t.Fatalf("totals: %+v", tot)
	}
}

func TestAllocateBudgetDefaultsWhenEmpty(t *testing.T) {
	plans, tot := AllocateBudget(500, 100, nil)
	if len(plans) != len(DefaultShares) || tot.BudgetRON != 500 {
		t.Fatalf("default split: %+v %+v", plans, tot)
	}
}

func TestSampleSizeKnownValue(t *testing.T) {
	// 1% → 1.3% (30% lift): classic result ≈ 20 000 per variant
	n := SampleSize(0.01, 0.30)
	if n < 19000 || n > 21500 {
		t.Fatalf("sample size = %d", n)
	}
	if SampleSize(0, 0.3) != 0 {
		t.Fatal("zero baseline must return 0")
	}
}

func TestSizeABTest(t *testing.T) {
	s := SizeABTest(MetricCTR, ChannelMeta, 175) // 25 lei/day
	if s.SampleUnit != "impressions" || s.BaselineRatePct != 1.0 {
		t.Fatalf("%+v", s)
	}
	wantCost := float64(2*s.SamplePerVariant) / 1000 * 12
	if !near(s.EstCostRON, wantCost, 0.01) || !near(s.EstDays, wantCost/25, 0.01) {
		t.Fatalf("cost/days: %+v", s)
	}
	if none := SizeABTest(MetricCVR, ChannelTikTok, 0); none.EstDays != -1 || none.FeasibleInCampaign {
		t.Fatalf("no budget: %+v", none)
	}
}

func TestComputeCost(t *testing.T) {
	c := ComputeCost(10, 0.01, 0.2, 0, 0.03, 1000)
	if !near(c.TotalCostUSD, 0.245, 1e-9) || !near(c.TotalCostRON, 0.245*USDToRON, 1e-6) {
		t.Fatalf("%+v", c)
	}
}

func TestMarketStats(t *testing.T) {
	snap := model.MarketSnapshot{Products: []model.Product{
		{ID: "a", Price: 10, Rating: 4, ReviewCount: 100, Seller: "S1"},
		{ID: "b", Price: 20, Rating: 5, ReviewCount: 100, Seller: "S1"},
		{ID: "c", Price: 30, Rating: 3, ReviewCount: 0, Seller: "S2"},
	}}
	m := ComputeMarket(snap)
	if m.PriceMedian != 20 || m.AvgRating != 4.5 || m.KnownSellerCount != 2 || m.TopSellers[0].ReviewSharePct != 100 {
		t.Fatalf("%+v", m)
	}
}

func TestTrendDirection(t *testing.T) {
	var pts []model.TrendPoint
	for i := 0; i < 104; i++ {
		v := 50
		if i >= 52 {
			v = 75
		}
		pts = append(pts, model.TrendPoint{Date: "2025-01-01", Value: v})
	}
	if tr := ComputeTrend(model.TrendSeries{Points: pts}); tr.Direction != "rising" || tr.YoYChangePct != 50 {
		t.Fatalf("%+v", tr)
	}
}
