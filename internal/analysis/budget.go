package analysis

import (
	"math"
	"sort"
)

// Paid channels the planner can use.
const (
	ChannelEmagAds   = "emag_ads"
	ChannelMeta      = "meta"
	ChannelTikTok    = "tiktok"
	ChannelGoogleAds = "google_ads"
)

// Channels lists the supported paid channels in display order.
var Channels = []string{ChannelEmagAds, ChannelMeta, ChannelTikTok, ChannelGoogleAds}

// Benchmark holds assumed Romanian e-commerce ad benchmarks for a channel.
// They are deliberately simple and exposed in GET /api/methodology.
type Benchmark struct {
	Label  string  `json:"label"`
	CPM    float64 `json:"cpm_ron"` // cost per 1000 impressions, lei
	CTRPct float64 `json:"ctr_pct"` // click-through rate, %
	CVRPct float64 `json:"cvr_pct"` // click → order conversion, %
}

// Benchmarks per channel.
var Benchmarks = map[string]Benchmark{
	ChannelEmagAds:   {Label: "eMAG Ads (produse sponsorizate)", CPM: 25, CTRPct: 1.2, CVRPct: 3.0},
	ChannelMeta:      {Label: "Facebook + Instagram", CPM: 12, CTRPct: 1.0, CVRPct: 1.2},
	ChannelTikTok:    {Label: "TikTok", CPM: 8, CTRPct: 0.8, CVRPct: 0.8},
	ChannelGoogleAds: {Label: "Google Ads (Search + Shopping)", CPM: 45, CTRPct: 3.0, CVRPct: 2.0},
}

// CampaignWeeks is the length of the campaign plan.
const CampaignWeeks = 4

// ChannelPlan is the deterministic budget + reach estimate for a channel.
type ChannelPlan struct {
	Channel         string  `json:"channel"`
	Label           string  `json:"label"`
	SharePct        float64 `json:"share_pct"`
	BudgetRON       float64 `json:"budget_ron"`
	WeeklyBudgetRON float64 `json:"weekly_budget_ron"`
	EstImpressions  int     `json:"est_impressions"`
	EstClicks       int     `json:"est_clicks"`
	EstOrders       float64 `json:"est_orders"`
	EstRevenueRON   float64 `json:"est_revenue_ron"`
	ROAS            float64 `json:"roas"` // revenue / spend
	CPCRON          float64 `json:"cpc_ron"`
	CPARON          float64 `json:"cpa_ron"` // cost per order; 0 if no orders
}

// BudgetTotals sums all channels.
type BudgetTotals struct {
	BudgetRON      float64 `json:"budget_ron"`
	EstImpressions int     `json:"est_impressions"`
	EstClicks      int     `json:"est_clicks"`
	EstOrders      float64 `json:"est_orders"`
	EstRevenueRON  float64 `json:"est_revenue_ron"`
	ROAS           float64 `json:"roas"`
	CPARON         float64 `json:"cpa_ron"`
}

// DefaultShares is used when the AI provides no valid split.
var DefaultShares = map[string]float64{ChannelEmagAds: 40, ChannelMeta: 35, ChannelTikTok: 25}

// AllocateBudget normalises the shares to 100% and estimates reach per channel.
// Unknown channels and non-positive shares are ignored.
func AllocateBudget(totalRON, salePrice float64, shares map[string]float64) ([]ChannelPlan, BudgetTotals) {
	clean := map[string]float64{}
	sum := 0.0
	for ch, s := range shares {
		if _, ok := Benchmarks[ch]; ok && s > 0 && !math.IsNaN(s) && !math.IsInf(s, 0) {
			clean[ch] += s
			sum += s
		}
	}
	if sum == 0 {
		clean, sum = DefaultShares, 100
	}
	plans := make([]ChannelPlan, 0, len(clean))
	var tot BudgetTotals
	for _, ch := range Channels {
		s, ok := clean[ch]
		if !ok {
			continue
		}
		b := Benchmarks[ch]
		p := ChannelPlan{Channel: ch, Label: b.Label, SharePct: Round2(s / sum * 100)}
		p.BudgetRON = Round2(totalRON * s / sum)
		p.WeeklyBudgetRON = Round2(p.BudgetRON / CampaignWeeks)
		imp := p.BudgetRON / b.CPM * 1000
		clicks := imp * b.CTRPct / 100
		orders := clicks * b.CVRPct / 100
		p.EstImpressions = int(math.Round(imp))
		p.EstClicks = int(math.Round(clicks))
		p.EstOrders = Round2(orders)
		p.EstRevenueRON = Round2(orders * salePrice)
		if p.BudgetRON > 0 {
			p.ROAS = Round2(p.EstRevenueRON / p.BudgetRON)
		}
		p.CPCRON = Round2(b.CPM / 1000 / (b.CTRPct / 100))
		if orders > 0 {
			p.CPARON = Round2(p.BudgetRON / orders)
		}
		plans = append(plans, p)
		tot.BudgetRON += p.BudgetRON
		tot.EstImpressions += p.EstImpressions
		tot.EstClicks += p.EstClicks
		tot.EstOrders += orders
		tot.EstRevenueRON += orders * salePrice
	}
	sort.SliceStable(plans, func(i, j int) bool { return plans[i].BudgetRON > plans[j].BudgetRON })
	tot.BudgetRON = Round2(tot.BudgetRON)
	if tot.EstOrders > 0 {
		tot.CPARON = Round2(tot.BudgetRON / tot.EstOrders)
	}
	tot.EstOrders = Round2(tot.EstOrders)
	tot.EstRevenueRON = Round2(tot.EstRevenueRON)
	if tot.BudgetRON > 0 {
		tot.ROAS = Round2(tot.EstRevenueRON / tot.BudgetRON)
	}
	return plans, tot
}
