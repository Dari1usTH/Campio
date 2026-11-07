package campaign

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/tibi/hackathon/backend/internal/ai"
	"github.com/tibi/hackathon/backend/internal/analysis"
	"github.com/tibi/hackathon/backend/internal/db"
	"github.com/tibi/hackathon/backend/internal/market"
	"github.com/tibi/hackathon/backend/internal/media"
	"github.com/tibi/hackathon/backend/internal/model"
	"github.com/tibi/hackathon/backend/internal/sandbox"
	"github.com/tibi/hackathon/backend/internal/seed"
)

// Config holds video/editing settings.
type Config struct {
	VideoModel       string
	VideoResolution  string
	VideoAspectRatio string
	VideoPollEvery   time.Duration
	EditorModel      string
}

// Service orchestrates campaigns.
type Service struct {
	Store   *db.Store
	Market  *market.Service
	AI      *ai.Client
	Media   *media.Store
	Sandbox *sandbox.Client
	Cfg     Config
	// SeedKeywords have precollected market data; the intake prefers them.
	SeedKeywords []string

	wg sync.WaitGroup
}

// ErrInvalid is returned for bad user input.
var ErrInvalid = errors.New("invalid request")

func invalid(format string, a ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalid, fmt.Sprintf(format, a...))
}

// Wait blocks until background jobs finish (used on shutdown/tests).
func (s *Service) Wait() { s.wg.Wait() }

// Create stores a new campaign from the seller's prompt and images and starts
// the async pipeline. The intake step may pause it with questions.
func (s *Service) Create(ctx context.Context, prompt string, images []ImageFile) (Kit, error) {
	prompt = strings.TrimSpace(prompt)
	if err := validatePrompt(prompt, images); err != nil {
		return Kit{}, err
	}
	if !s.AI.Enabled() {
		return Kit{}, ai.ErrNotConfigured
	}
	now := time.Now().UTC()
	k := Kit{ID: uuid.New(), CreatedAt: now, UpdatedAt: now, Status: StatusRunning, Step: StepIntake,
		Input: Input{Prompt: prompt}, AIModel: s.AI.Model}
	for _, st := range pipeline {
		k.Steps = append(k.Steps, StepInfo{Step: st, Status: StatusPending})
	}
	k.setStep(StepIntake, StatusRunning, 0)
	k.normalize()
	b, _ := json.Marshal(k)
	if err := s.Store.InsertCampaign(ctx, db.CampaignRow{ID: k.ID, CreatedAt: now, Status: k.Status, Step: k.Step, Kit: b}); err != nil {
		return Kit{}, err
	}
	ids, err := s.saveImages(ctx, k.ID, images)
	if err != nil {
		_ = s.Store.DeleteCampaign(context.Background(), k.ID)
		_ = s.Media.RemoveCampaign(k.ID.String())
		return Kit{}, err
	}
	k.Input.ImageAssetIDs = ids
	b, _ = json.Marshal(k)
	if err := s.Store.UpdateCampaignProgress(ctx, k.ID, k.Status, k.Step, "", b, 0, 0); err != nil {
		return Kit{}, err
	}
	s.start(k)
	return k, nil
}

func (s *Service) start(k Kit) {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.run(k)
	}()
}

// run executes intake → market → (questions?) → strategy → content → plan.
// It is called again after the seller answers; finished steps are kept.
func (s *Service) run(k Kit) {
	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Minute)
	defer cancel()
	var usage ai.Usage
	pages := 0
	marketKeyword := ""
	if row, err := s.Store.GetCampaign(ctx, k.ID); err == nil {
		usage.Cost, pages, marketKeyword = row.AICostUSD, row.PagesFetched, row.Keyword
	}
	save := func() {
		b, _ := json.Marshal(k)
		if err := s.Store.UpdateCampaignProgress(ctx, k.ID, k.Status, k.Step, k.Error, b, usage.Cost, pages); err != nil {
			slog.Error("save campaign", "id", k.ID, "err", err)
		}
	}
	fail := func(step string, err error) {
		slog.Warn("campaign failed", "id", k.ID, "step", step, "err", err)
		k.Status, k.Error = StatusFailed, err.Error()
		k.setStep(step, StatusFailed, 0)
		save()
	}
	begin := func(step string) time.Time {
		k.Step = step
		k.setStep(step, StatusRunning, 0)
		save()
		return time.Now()
	}
	// ask pauses the pipeline with questions; it returns false when none are needed.
	ask := func(qs []Question) bool {
		if len(qs) == 0 {
			return false
		}
		k.Intake.Round++
		k.Intake.Questions = qs
		k.Status, k.Step = StatusNeedsInput, StepIntake
		k.setStep(StepIntake, StatusWaiting, 0)
		save()
		return true
	}

	// 0. intake: understand the prompt, images and answers
	t0 := begin(StepIntake)
	res, u, err := s.AI.Intake(ctx, k.Input.Prompt, s.imageURLs(ctx, k.Input.ImageAssetIDs), intakeHistory(k.Intake.Answers), s.SeedKeywords)
	usage.Add(u)
	if err != nil {
		fail(StepIntake, err)
		return
	}
	applyIntake(&k, res)
	_ = s.Store.SetCampaignProduct(ctx, k.ID, k.Input.ProductName)
	lastRound := k.Intake.Round >= maxIntakeRounds
	if k.Input.ProductName == "" {
		if lastRound {
			fail(StepIntake, invalid("nu am reușit să înțeleg ce produs vrei să vinzi"))
			return
		}
		if ask(buildQuestions(&k, res.Questions, nil)) {
			return
		}
	}

	// 1. market data (skipped when already fetched for this keyword)
	var ms analysis.MarketStats
	if k.Market == nil || seed.NormalizeKeyword(k.Input.Keyword) != marketKeyword {
		t1 := begin(StepMarket)
		var (
			snap    model.MarketSnapshot
			snapErr error
			ts      model.TrendSeries
			wg      sync.WaitGroup
		)
		wg.Add(2)
		go func() { defer wg.Done(); snap, snapErr = s.Market.Snapshot(ctx, k.Input.Keyword) }()
		go func() { defer wg.Done(); ts = s.Market.Trend(ctx, k.Input.Keyword) }()
		wg.Wait()
		if snapErr != nil {
			if errors.Is(snapErr, market.ErrNoData) && !lastRound {
				// Let the seller give a better search term instead of failing.
				k.setStep(StepMarket, StatusPending, 0)
				q := buildQuestions(&k, res.Questions, nil)
				kw := Question{ID: fmt.Sprintf("q%d_kw", k.Intake.Round+1), Field: ai.FieldKeyword, Kind: "text", Required: true, Options: []QuestionOption{},
					Text: fmt.Sprintf("Nu am găsit produse pe eMAG pentru „%s”. Ce ar scrie un client în căutare ca să găsească produsul tău?", k.Input.Keyword)}
				k.Input.Keyword = ""
				ask(append([]Question{kw}, q...))
				return
			}
			fail(StepMarket, snapErr)
			return
		}
		pages += snap.PagesFetched
		_ = s.Store.SetCampaignData(ctx, k.ID, snap, ts)
		ms = analysis.ComputeMarket(snap)
		k.Market = &MarketBlock{
			SourceInfo:      SourceInfo{Source: snap.Source, FetchedAt: snap.FetchedAt, FallbackNote: snap.FallbackNote},
			Stats:           ms,
			ReviewsAnalyzed: len(snap.Reviews),
			Competitors:     topProducts(snap.Products, 12),
		}
		k.Trend = &TrendBlock{
			SourceInfo: SourceInfo{Source: ts.Source, FetchedAt: ts.FetchedAt, FallbackNote: ts.FallbackNote},
			Stats:      analysis.ComputeTrend(ts),
			Monthly:    monthly(ts.Points),
		}
		k.setStep(StepMarket, StatusCompleted, time.Since(t1))
	} else {
		ms = k.Market.Stats
	}

	// questions about price / budget, with market-based hints and quick answers
	applyDefaults(&k, ms, lastRound)
	if ask(buildQuestions(&k, res.Questions, &ms)) {
		return
	}
	if k.Input.SalePrice <= 0 { // no answer and no market median
		fail(StepIntake, invalid("lipsește prețul de vânzare"))
		return
	}
	if ms.PriceMedian > 0 {
		k.Market.PriceVsMedian = analysis.Round2((k.Input.SalePrice/ms.PriceMedian - 1) * 100)
	}
	k.setStep(StepIntake, StatusCompleted, time.Since(t0))

	// The strategy needs raw reviews; load them from the stored snapshot.
	row, err := s.Store.GetCampaign(ctx, k.ID)
	if err != nil || row.Market == nil {
		fail(StepStrategy, fmt.Errorf("market data missing: %v", err))
		return
	}
	snap := *row.Market

	// 2. strategy
	t0 = begin(StepStrategy)
	strat, u, err := s.AI.GenerateStrategy(ctx, k.Input.brief(), ms, k.Trend.Stats, snap)
	usage.Add(u)
	if err != nil {
		fail(StepStrategy, err)
		return
	}
	k.Strategy = &strat
	k.setStep(StepStrategy, StatusCompleted, time.Since(t0))

	// 3. content
	t0 = begin(StepContent)
	content, u, err := s.AI.GenerateContent(ctx, k.Input.brief(), strat, ms)
	usage.Add(u)
	if err != nil {
		fail(StepContent, err)
		return
	}
	k.Content = &content
	k.setStep(StepContent, StatusCompleted, time.Since(t0))

	// 4. plan (AI picks channels/tests; code computes every number)
	t0 = begin(StepPlan)
	plan, u, err := s.AI.GeneratePlan(ctx, k.Input.brief(), strat, content)
	usage.Add(u)
	if err != nil {
		fail(StepPlan, err)
		return
	}
	pb := BuildPlan(k.Input, plan)
	k.Plan = &pb
	k.setStep(StepPlan, StatusCompleted, time.Since(t0))

	k.Status, k.Step = StatusCompleted, StepDone
	save()
}

// Get loads a kit and fills live fields (status, cost).
func (s *Service) Get(ctx context.Context, id uuid.UUID) (Kit, db.CampaignRow, error) {
	row, err := s.Store.GetCampaign(ctx, id)
	if err != nil {
		return Kit{}, row, err
	}
	var k Kit
	if err := json.Unmarshal(row.Kit, &k); err != nil {
		return Kit{}, row, err
	}
	k.Status, k.Step, k.Error, k.UpdatedAt = row.Status, row.Step, row.Error, row.UpdatedAt
	k.normalize()
	video, err := s.Store.SumAssetCost(ctx, id, KindGenerated)
	if err != nil {
		return k, row, err
	}
	editing, err := s.Store.SumEditCost(ctx, id)
	if err != nil {
		return k, row, err
	}
	k.Cost = analysis.ComputeCost(row.PagesFetched, row.AICostUSD, video, editing, k.Input.AdBudgetRON)
	return k, row, nil
}

func topProducts(ps []model.Product, n int) []model.Product {
	cp := append([]model.Product(nil), ps...)
	sort.SliceStable(cp, func(i, j int) bool { return cp[i].ReviewCount > cp[j].ReviewCount })
	if len(cp) > n {
		cp = cp[:n]
	}
	if cp == nil {
		cp = []model.Product{}
	}
	return cp
}
