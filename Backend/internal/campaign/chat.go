package campaign

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"

	"github.com/tibi/hackathon/backend/internal/ai"
	"github.com/tibi/hackathon/backend/internal/analysis"
	"github.com/tibi/hackathon/backend/internal/db"
)

// BudgetSimulation is the result of the simulate_budget tool.
type BudgetSimulation struct {
	TotalBudgetRON float64                `json:"total_budget_ron"`
	Shares         map[string]float64     `json:"shares"`
	Channels       []analysis.ChannelPlan `json:"channels"`
	Totals         analysis.BudgetTotals  `json:"totals"`
}

// ChatReply is the result of posting a chat message.
type ChatReply struct {
	UserMessage      db.ChatMessage     `json:"user_message"`
	AssistantMessage db.ChatMessage     `json:"assistant_message"`
	Simulations      []BudgetSimulation `json:"simulations"`
}

// ErrNotReady is returned when the kit is still being generated.
var ErrNotReady = fmt.Errorf("%w: the marketing kit is not ready yet", ErrInvalid)

// Chat answers a user message about a campaign. onDelta/onSim are optional streaming hooks.
func (s *Service) Chat(ctx context.Context, id uuid.UUID, text string, onDelta func(string), onSim func(BudgetSimulation)) (ChatReply, error) {
	var reply ChatReply
	if !s.AI.Enabled() {
		return reply, ai.ErrNotConfigured
	}
	k, _, err := s.Get(ctx, id)
	if err != nil {
		return reply, err
	}
	if k.Status != StatusCompleted {
		return reply, ErrNotReady
	}
	history, err := s.Store.ListMessages(ctx, id)
	if err != nil {
		return reply, err
	}
	msgs := []ai.Message{{Role: "system", Content: ai.ChatSystem + chatContext(k)}}
	for _, m := range history {
		c := m.Content
		if m.Role == "assistant" && len(m.Simulations) > 0 {
			c += "\n[Simulări de buget efectuate: " + string(m.Simulations) + "]"
		}
		msgs = append(msgs, ai.Message{Role: m.Role, Content: c})
	}
	msgs = append(msgs, ai.Message{Role: "user", Content: text})

	userMsg := db.ChatMessage{CampaignID: id, Role: "user", Content: text}
	if err := s.Store.InsertMessage(ctx, &userMsg); err != nil {
		return reply, err
	}
	reply.UserMessage = userMsg
	reply.Simulations = []BudgetSimulation{}

	currentShares := map[string]float64{}
	if k.Plan != nil {
		for _, c := range k.Plan.Channels {
			currentShares[c.Channel] = c.SharePct
		}
	}
	handler := func(_ context.Context, name string, args json.RawMessage) (string, any, bool, error) {
		if name != ai.SimulateBudgetTool.Function.Name {
			return "", nil, false, fmt.Errorf("unknown tool %q", name)
		}
		var a struct {
			TotalBudgetRON *float64           `json:"total_budget_ron"`
			Shares         map[string]float64 `json:"shares"`
		}
		if err := json.Unmarshal(args, &a); err != nil {
			return "", nil, false, err
		}
		total := k.Input.AdBudgetRON
		if a.TotalBudgetRON != nil {
			if *a.TotalBudgetRON < 0 {
				return "", nil, false, fmt.Errorf("total_budget_ron must be >= 0")
			}
			total = *a.TotalBudgetRON
		}
		shares := a.Shares
		if len(shares) == 0 {
			shares = currentShares
		}
		plans, totals := analysis.AllocateBudget(total, k.Input.SalePrice, shares)
		sim := BudgetSimulation{TotalBudgetRON: total, Shares: shares, Channels: plans, Totals: totals}
		return toJSON(sim), sim, false, nil
	}
	var onKeep func(any)
	if onSim != nil {
		onKeep = func(v any) { onSim(v.(BudgetSimulation)) }
	}
	res, err := s.AI.RunAgent(ctx, msgs, ai.AgentOptions{Tools: []ai.Tool{ai.SimulateBudgetTool}, MaxSteps: 4, MaxTokens: 2000, Temperature: 0.4, OnDelta: onDelta, OnKeep: onKeep}, handler)
	if err != nil {
		return reply, err
	}
	for _, v := range res.Kept {
		reply.Simulations = append(reply.Simulations, v.(BudgetSimulation))
	}
	asst := db.ChatMessage{CampaignID: id, Role: "assistant", Content: res.Content, CostUSD: analysis.Round6(res.Usage.Cost)}
	if len(reply.Simulations) > 0 {
		asst.Simulations, _ = json.Marshal(reply.Simulations)
	}
	if err := s.Store.InsertMessage(ctx, &asst); err != nil {
		return reply, err
	}
	_ = s.Store.AddCampaignAICost(ctx, id, res.Usage.Cost)
	reply.AssistantMessage = asst
	return reply, nil
}

func chatContext(k Kit) string {
	c := k
	c.Trend = nil
	if c.Market != nil {
		m := *c.Market
		if len(m.Competitors) > 5 {
			m.Competitors = m.Competitors[:5]
		}
		c.Market = &m
	}
	return toJSON(c)
}
