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

	wg sync.WaitGroup
}

// ErrInvalid is returned for bad user input.
var ErrInvalid = errors.New("invalid request")

func invalid(format string, a ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalid, fmt.Sprintf(format, a...))
}

// Validate checks the input.
func Validate(in Input) error {
	var errs []string
	if strings.TrimSpace(in.ProductName) == "" {
		errs = append(errs, "product_name is required")
	}
	if strings.TrimSpace(in.Keyword) == "" {
		errs = append(errs, "keyword is required")
	}
	if in.SalePrice <= 0 {
		errs = append(errs, "sale_price must be > 0")
	}
	if in.AdBudgetRON < 0 {
		errs = append(errs, "ad_budget_ron must be >= 0")
	}
	if in.ProductImageURL != "" && !strings.HasPrefix(in.ProductImageURL, "https://") {
		errs = append(errs, "product_image_url must be an https URL")
	}
	if len(in.ProductDescription) > 4000 {
		errs = append(errs, "product_description too long (max 4000 chars)")
	}
	if len(errs) > 0 {
		return invalid("%s", strings.Join(errs, "; "))
	}
	return nil
}

// Wait blocks until background jobs finish (used on shutdown/tests).
func (s *Service) Wait() { s.wg.Wait() }

// Create stores a new campaign and starts the async pipeline.
func (s *Service) Create(ctx context.Context, in Input) (Kit, error) {
	if err := Validate(in); err != nil {
		return Kit{}, err
	}
	if !s.AI.Enabled() {
		return Kit{}, ai.ErrNotConfigured
	}
	now := time.Now().UTC()
	k := Kit{ID: uuid.New(), CreatedAt: now, UpdatedAt: now, Status: StatusRunning, Step: StepMarket, Input: in, AIModel: s.AI.Model}
	for _, st := range pipeline {
		k.Steps = append(k.Steps, StepInfo{Step: st, Status: StatusPending})
	}
	k.setStep(StepMarket, StatusRunning, 0)
	b, _ := json.Marshal(k)
	if err := s.Store.InsertCampaign(ctx, db.CampaignRow{ID: k.ID, CreatedAt: now, Status: k.Status, Step: k.Step,
		ProductName: in.ProductName, Keyword: in.Keyword, Kit: b}); err != nil {
		return Kit{}, err
	}
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.run(k)
	}()
	return k, nil
}

func (s *Service) run(k Kit) {
	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Minute)
	defer cancel()
	var usage ai.Usage
	pages := 0
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

	// 1. market data
	t0 := time.Now()
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
		fail(StepMarket, snapErr)
		return
	}
	pages = snap.PagesFetched
	_ = s.Store.SetCampaignData(ctx, k.ID, snap, ts)
	ms := analysis.ComputeMarket(snap)
	tst := analysis.ComputeTrend(ts)
	k.Market = &MarketBlock{
		SourceInfo:      SourceInfo{Source: snap.Source, FetchedAt: snap.FetchedAt, FallbackNote: snap.FallbackNote},
		Stats:           ms,
		ReviewsAnalyzed: len(snap.Reviews),
		Competitors:     topProducts(snap.Products, 12),
	}
	if ms.PriceMedian > 0 {
		k.Market.PriceVsMedian = analysis.Round2((k.Input.SalePrice/ms.PriceMedian - 1) * 100)
	}
	k.Trend = &TrendBlock{
		SourceInfo: SourceInfo{Source: ts.Source, FetchedAt: ts.FetchedAt, FallbackNote: ts.FallbackNote},
		Stats:      tst,
		Monthly:    monthly(ts.Points),
	}
	k.setStep(StepMarket, StatusCompleted, time.Since(t0))

	// 2. strategy
	t0 = begin(StepStrategy)
	strat, u, err := s.AI.GenerateStrategy(ctx, k.Input.brief(), ms, tst, snap)
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
