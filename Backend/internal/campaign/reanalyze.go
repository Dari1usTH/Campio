package campaign

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/tibi/hackathon/backend/internal/ai"
)

// ErrBusy is returned when a re-analysis is requested while the pipeline runs.
var ErrBusy = fmt.Errorf("%w: the campaign is still running", ErrInvalid)

// ReanalyzeRequest asks for a fresh analysis of the product. Both fields are optional.
type ReanalyzeRequest struct {
	Message string `json:"message"` // extra guidance for the new analysis
	Keyword string `json:"keyword"` // new market search term
}

// Reanalyze re-runs the whole pipeline (fresh market scrape, strategy, content,
// plan), keeping the seller's earlier answers.
func (s *Service) Reanalyze(ctx context.Context, id uuid.UUID, req ReanalyzeRequest) (Kit, error) {
	if !s.AI.Enabled() && !s.Cfg.MockAI {
		return Kit{}, ai.ErrNotConfigured
	}
	k, _, err := s.Get(ctx, id)
	if err != nil {
		return Kit{}, err
	}
	if err := resetForReanalysis(&k, req, time.Now().UTC()); err != nil {
		return Kit{}, err
	}
	b, _ := json.Marshal(k)
	ok, err := s.Store.RestartCampaign(ctx, id, b)
	if err != nil {
		return Kit{}, err
	}
	if !ok {
		return Kit{}, ErrBusy // started concurrently
	}
	s.launch(k, true)
	return k, nil
}

// resetForReanalysis records the request on the kit and clears every generated
// section so the pipeline rebuilds it.
func resetForReanalysis(k *Kit, req ReanalyzeRequest, now time.Time) error {
	switch k.Status {
	case StatusCompleted, StatusFailed, StatusNeedsInput:
	default:
		return ErrBusy
	}
	msg, kw := strings.TrimSpace(req.Message), strings.TrimSpace(req.Keyword)
	if len([]rune(msg)) > maxPromptChars {
		return invalid("message too long (max %d chars)", maxPromptChars)
	}
	if len([]rune(kw)) > maxAnswerChars {
		return invalid("keyword too long (max %d chars)", maxAnswerChars)
	}
	round := k.Intake.Round
	if kw != "" {
		k.Intake.Answers = append(k.Intake.Answers, Answer{Field: ai.FieldKeyword, Question: "Termen de căutare nou la re-analiză", Value: kw, Round: round, At: now})
		k.Input.Keyword = kw
	}
	if msg != "" {
		k.Intake.Answers = append(k.Intake.Answers, Answer{Field: ai.FieldOther, Question: "Cerință la re-analiză", Value: msg, Round: round, At: now})
	}

	k.Market, k.Trend, k.Web = nil, nil, nil
	k.Strategy, k.Content, k.Plan = nil, nil, nil
	k.Intake.Questions = []Question{}
	k.Steps = k.Steps[:0]
	for _, st := range pipeline {
		k.Steps = append(k.Steps, StepInfo{Step: st, Status: StatusPending})
	}
	k.Status, k.Step, k.Error = StatusRunning, StepIntake, ""
	k.setStep(StepIntake, StatusRunning, 0)
	k.Reanalyzed++
	k.ReanalyzedAt = &now
	return nil
}
