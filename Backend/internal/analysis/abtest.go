package analysis

import "math"

// A/B test sizing constants (two-sided α = 0.05, power = 0.80).
const (
	ZAlpha                   = 1.959964
	ZBeta                    = 0.841621
	DefaultMinDetectableLift = 30.0 // relative lift we want to be able to detect, %
	MetricCTR                = "ctr"
	MetricCVR                = "cvr"
)

// ABTestSizing tells how much traffic, money and time a test needs.
type ABTestSizing struct {
	Metric               string  `json:"metric"`                  // ctr | cvr
	SampleUnit           string  `json:"sample_unit"`             // impressions | clicks
	BaselineRatePct      float64 `json:"baseline_rate_pct"`       // from the channel benchmark
	MinDetectableLiftPct float64 `json:"min_detectable_lift_pct"` // relative
	SamplePerVariant     int     `json:"sample_per_variant"`
	EstCostRON           float64 `json:"est_cost_ron"`
	EstDays              float64 `json:"est_days"`             // -1 when the channel has no budget
	FeasibleInCampaign   bool    `json:"feasible_in_campaign"` // finishes within the 4-week plan
}

// SampleSize returns the per-variant sample for a two-proportion z-test.
func SampleSize(baseline, relativeLift float64) int {
	p1 := baseline
	p2 := baseline * (1 + relativeLift)
	if p1 <= 0 || p2 >= 1 || p2 == p1 {
		return 0
	}
	pbar := (p1 + p2) / 2
	num := ZAlpha*math.Sqrt(2*pbar*(1-pbar)) + ZBeta*math.Sqrt(p1*(1-p1)+p2*(1-p2))
	return int(math.Ceil(num * num / ((p2 - p1) * (p2 - p1))))
}

// SizeABTest sizes a test on a channel given that channel's weekly budget.
func SizeABTest(metric, channel string, weeklyBudgetRON float64) ABTestSizing {
	b, ok := Benchmarks[channel]
	if !ok {
		b = Benchmarks[ChannelMeta]
	}
	if metric != MetricCVR {
		metric = MetricCTR
	}
	s := ABTestSizing{Metric: metric, MinDetectableLiftPct: DefaultMinDetectableLift, EstDays: -1}
	lift := DefaultMinDetectableLift / 100
	cpc := b.CPM / 1000 / (b.CTRPct / 100)
	if metric == MetricCTR {
		s.SampleUnit = "impressions"
		s.BaselineRatePct = b.CTRPct
		s.SamplePerVariant = SampleSize(b.CTRPct/100, lift)
		s.EstCostRON = Round2(float64(2*s.SamplePerVariant) / 1000 * b.CPM)
	} else {
		s.SampleUnit = "clicks"
		s.BaselineRatePct = b.CVRPct
		s.SamplePerVariant = SampleSize(b.CVRPct/100, lift)
		s.EstCostRON = Round2(float64(2*s.SamplePerVariant) * cpc)
	}
	if weeklyBudgetRON > 0 {
		s.EstDays = Round2(s.EstCostRON / (weeklyBudgetRON / 7))
		s.FeasibleInCampaign = s.EstDays <= CampaignWeeks*7
	}
	return s
}
