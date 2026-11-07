package analysis

const (
	// USDToRON is a fixed exchange rate used only for cost reporting.
	USDToRON = 4.6
	// ScraperCostPerPageUSD estimates infrastructure/proxy cost per fetched page.
	ScraperCostPerPageUSD = 0.0005
)

// CostSummary is what producing the marketing kit cost, vs. the ad budget it steers.
type CostSummary struct {
	ScraperCostUSD  float64 `json:"scraper_cost_usd"`
	PagesFetched    int     `json:"pages_fetched"`
	AITextCostUSD   float64 `json:"ai_text_cost_usd"` // strategy + content + plan + chat
	VideoCostUSD    float64 `json:"video_cost_usd"`   // generated clips
	EditingCostUSD  float64 `json:"editing_cost_usd"` // AI editor
	TotalCostUSD    float64 `json:"total_cost_usd"`
	TotalCostRON    float64 `json:"total_cost_ron"`
	AdBudgetRON     float64 `json:"ad_budget_ron"`
	CostPctOfBudget float64 `json:"cost_pct_of_budget"`
	USDToRON        float64 `json:"usd_to_ron"`
}

// ComputeCost aggregates costs.
func ComputeCost(pages int, aiText, video, editing, budgetRON float64) CostSummary {
	c := CostSummary{
		PagesFetched:   pages,
		ScraperCostUSD: Round6(float64(pages) * ScraperCostPerPageUSD),
		AITextCostUSD:  Round6(aiText),
		VideoCostUSD:   Round6(video),
		EditingCostUSD: Round6(editing),
		AdBudgetRON:    budgetRON,
		USDToRON:       USDToRON,
	}
	c.TotalCostUSD = Round6(c.ScraperCostUSD + c.AITextCostUSD + c.VideoCostUSD + c.EditingCostUSD)
	c.TotalCostRON = Round6(c.TotalCostUSD * USDToRON)
	if budgetRON > 0 {
		c.CostPctOfBudget = Round6(c.TotalCostRON / budgetRON * 100)
	}
	return c
}
