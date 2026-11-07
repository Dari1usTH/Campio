package campaign

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/tibi/hackathon/backend/internal/ai"
)

func doneKit() Kit {
	k := Kit{Status: StatusCompleted, Step: StepDone, Error: "old", Input: Input{Keyword: "suport laptop"}}
	for _, st := range pipeline {
		k.Steps = append(k.Steps, StepInfo{Step: st, Status: StatusCompleted, DurationMS: 100})
	}
	k.Market, k.Trend, k.Web = &MarketBlock{}, &TrendBlock{}, &WebBlock{}
	k.Strategy, k.Content, k.Plan = &ai.Strategy{}, &ai.Content{}, &PlanBlock{}
	k.Intake.Round = 2
	k.Intake.Answers = []Answer{{Field: ai.FieldSalePrice, Value: "49"}}
	return k
}

func TestResetForReanalysis(t *testing.T) {
	k := doneKit()
	now := time.Now().UTC()
	if err := resetForReanalysis(&k, ReanalyzeRequest{Message: " premium buyers ", Keyword: "stand laptop"}, now); err != nil {
		t.Fatal(err)
	}
	if k.Market != nil || k.Trend != nil || k.Web != nil || k.Strategy != nil || k.Content != nil || k.Plan != nil {
		t.Fatal("generated sections not cleared")
	}
	if k.Status != StatusRunning || k.Step != StepIntake || k.Error != "" {
		t.Fatalf("status=%s step=%s err=%q", k.Status, k.Step, k.Error)
	}
	for _, s := range k.Steps {
		want := StatusPending
		if s.Step == StepIntake {
			want = StatusRunning
		}
		if s.Status != want || s.DurationMS != 0 {
			t.Fatalf("step %s = %s (%dms)", s.Step, s.Status, s.DurationMS)
		}
	}
	if len(k.Steps) != len(pipeline) {
		t.Fatalf("steps = %d", len(k.Steps))
	}
	if k.Input.Keyword != "stand laptop" || answeredText(k.Intake.Answers, ai.FieldKeyword) != "stand laptop" {
		t.Fatal("keyword not applied")
	}
	if answeredText(k.Intake.Answers, ai.FieldOther) != "premium buyers" || len(k.Intake.Answers) != 3 {
		t.Fatalf("answers = %+v", k.Intake.Answers)
	}
	if k.Reanalyzed != 1 || k.ReanalyzedAt == nil {
		t.Fatal("reanalysis not recorded")
	}
}

func TestResetForReanalysisEmptyKeepsInput(t *testing.T) {
	k := doneKit()
	if err := resetForReanalysis(&k, ReanalyzeRequest{}, time.Now()); err != nil {
		t.Fatal(err)
	}
	if k.Input.Keyword != "suport laptop" || len(k.Intake.Answers) != 1 {
		t.Fatal("empty request changed the input")
	}
}

func TestResetForReanalysisRejects(t *testing.T) {
	k := doneKit()
	k.Status = StatusRunning
	if err := resetForReanalysis(&k, ReanalyzeRequest{}, time.Now()); !errors.Is(err, ErrBusy) {
		t.Fatalf("running: err = %v", err)
	}
	k = doneKit()
	if err := resetForReanalysis(&k, ReanalyzeRequest{Message: strings.Repeat("a", maxPromptChars+1)}, time.Now()); !errors.Is(err, ErrInvalid) {
		t.Fatalf("long message: err = %v", err)
	}
	if k.Market == nil {
		t.Fatal("rejected request mutated the kit")
	}
}
