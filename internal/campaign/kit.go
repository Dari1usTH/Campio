// Package campaign builds marketing kits (async pipeline), generates video
// clips through OpenRouter, runs the AI video editor and the campaign chat.
package campaign

import (
	"time"

	"github.com/google/uuid"

	"github.com/tibi/hackathon/backend/internal/ai"
	"github.com/tibi/hackathon/backend/internal/analysis"
	"github.com/tibi/hackathon/backend/internal/model"
)

// Pipeline steps and statuses.
const (
	StepMarket   = "market"
	StepStrategy = "strategy"
	StepContent  = "content"
	StepPlan     = "plan"
	StepDone     = "done"

	StatusRunning   = "running"
	StatusCompleted = "completed"
	StatusFailed    = "failed"
	StatusPending   = "pending"
)

var pipeline = []string{StepMarket, StepStrategy, StepContent, StepPlan}

// Input is what the seller submits.
type Input struct {
	ProductName        string  `json:"product_name"`
	Keyword            string  `json:"keyword"`
	ProductDescription string  `json:"product_description,omitempty"`
	SalePrice          float64 `json:"sale_price"`
	AdBudgetRON        float64 `json:"ad_budget_ron"`
	BrandName          string  `json:"brand_name,omitempty"`
	ProductImageURL    string  `json:"product_image_url,omitempty"`
}

func (in Input) brief() ai.ProductBrief {
	return ai.ProductBrief{ProductName: in.ProductName, Keyword: in.Keyword, ProductDescription: in.ProductDescription,
		SalePrice: in.SalePrice, BrandName: in.BrandName, AdBudgetRON: in.AdBudgetRON}
}

// StepInfo reports pipeline progress.
type StepInfo struct {
	Step       string `json:"step"`
	Status     string `json:"status"` // pending | running | completed | failed
	DurationMS int64  `json:"duration_ms"`
}

// SourceInfo describes where data came from.
type SourceInfo struct {
	Source       string    `json:"source"`
	FetchedAt    time.Time `json:"fetched_at"`
	FallbackNote string    `json:"fallback_note,omitempty"`
}

// MarketBlock is the "understand the market" section.
type MarketBlock struct {
	SourceInfo
	Stats           analysis.MarketStats `json:"stats"`
	ReviewsAnalyzed int                  `json:"reviews_analyzed"`
	PriceVsMedian   float64              `json:"price_vs_median_pct"`
	Competitors     []model.Product      `json:"competitors"`
}

// MonthPoint is a monthly-averaged trend point.
type MonthPoint struct {
	Month string  `json:"month"`
	Value float64 `json:"value"`
}

// TrendBlock is the Google Trends section.
type TrendBlock struct {
	SourceInfo
	Stats   analysis.TrendStats `json:"stats"`
	Monthly []MonthPoint        `json:"monthly"`
}

// ChannelPlan merges the AI rationale with the code-computed numbers.
type ChannelPlan struct {
	analysis.ChannelPlan
	Rationale string   `json:"rationale"`
	Formats   []string `json:"formats"`
}

// ABTest is an AI-proposed test sized by code.
type ABTest struct {
	ai.ABTestIdea
	Sizing analysis.ABTestSizing `json:"sizing"`
}

// PlanBlock is the campaign plan section.
type PlanBlock struct {
	Channels []ChannelPlan         `json:"channels"`
	Totals   analysis.BudgetTotals `json:"totals"`
	Calendar []ai.CalendarWeek     `json:"calendar"`
	ABTests  []ABTest              `json:"ab_tests"`
	KPIs     []string              `json:"kpis"`
}

// Kit is the full marketing kit returned by the API. Sections are null until their step completes.
type Kit struct {
	ID        uuid.UUID            `json:"id"`
	CreatedAt time.Time            `json:"created_at"`
	UpdatedAt time.Time            `json:"updated_at"`
	Status    string               `json:"status"`
	Step      string               `json:"step"`
	Error     string               `json:"error,omitempty"`
	Steps     []StepInfo           `json:"steps"`
	Input     Input                `json:"input"`
	Market    *MarketBlock         `json:"market"`
	Trend     *TrendBlock          `json:"trend"`
	Strategy  *ai.Strategy         `json:"strategy"`
	Content   *ai.Content          `json:"content"`
	Plan      *PlanBlock           `json:"plan"`
	AIModel   string               `json:"ai_model"`
	Cost      analysis.CostSummary `json:"cost"`
}

func (k *Kit) setStep(step, status string, d time.Duration) {
	for i := range k.Steps {
		if k.Steps[i].Step == step {
			k.Steps[i].Status = status
			if d > 0 {
				k.Steps[i].DurationMS = d.Milliseconds()
			}
		}
	}
}

// BuildPlan turns the AI plan into the API block, computing all numbers.
func BuildPlan(in Input, p ai.Plan) PlanBlock {
	shares := map[string]float64{}
	meta := map[string]ai.ChannelChoice{}
	for _, c := range p.Channels {
		shares[c.Channel] += c.SharePct
		meta[c.Channel] = c
	}
	plans, totals := analysis.AllocateBudget(in.AdBudgetRON, in.SalePrice, shares)
	out := PlanBlock{Totals: totals, Calendar: p.Calendar, KPIs: p.KPIs, Channels: []ChannelPlan{}, ABTests: []ABTest{}}
	weekly := map[string]float64{}
	for _, cp := range plans {
		m := meta[cp.Channel]
		if m.Formats == nil {
			m.Formats = []string{}
		}
		out.Channels = append(out.Channels, ChannelPlan{ChannelPlan: cp, Rationale: m.Rationale, Formats: m.Formats})
		weekly[cp.Channel] = cp.WeeklyBudgetRON
	}
	for _, t := range p.ABTests {
		out.ABTests = append(out.ABTests, ABTest{ABTestIdea: t, Sizing: analysis.SizeABTest(t.Metric, t.Channel, weekly[t.Channel])})
	}
	if out.Calendar == nil {
		out.Calendar = []ai.CalendarWeek{}
	}
	if out.KPIs == nil {
		out.KPIs = []string{}
	}
	return out
}

func monthly(pts []model.TrendPoint) []MonthPoint {
	out := []MonthPoint{}
	idx := map[string]int{}
	counts := []int{}
	for _, p := range pts {
		if len(p.Date) < 7 {
			continue
		}
		m := p.Date[:7]
		i, ok := idx[m]
		if !ok {
			i = len(out)
			idx[m] = i
			out = append(out, MonthPoint{Month: m})
			counts = append(counts, 0)
		}
		out[i].Value += float64(p.Value)
		counts[i]++
	}
	for i := range out {
		out[i].Value = analysis.Round2(out[i].Value / float64(counts[i]))
	}
	return out
}
