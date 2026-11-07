// Command server runs the marketing-kit API.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	backend "github.com/tibi/hackathon/backend"
	"github.com/tibi/hackathon/backend/internal/ai"
	"github.com/tibi/hackathon/backend/internal/campaign"
	"github.com/tibi/hackathon/backend/internal/config"
	"github.com/tibi/hackathon/backend/internal/db"
	"github.com/tibi/hackathon/backend/internal/httpapi"
	"github.com/tibi/hackathon/backend/internal/market"
	"github.com/tibi/hackathon/backend/internal/media"
	"github.com/tibi/hackathon/backend/internal/sandbox"
	"github.com/tibi/hackathon/backend/internal/scraper/amazon"
	"github.com/tibi/hackathon/backend/internal/scraper/betalist"
	"github.com/tibi/hackathon/backend/internal/scraper/emag"
	"github.com/tibi/hackathon/backend/internal/scraper/reddit"
	"github.com/tibi/hackathon/backend/internal/trends"
)

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))
	cfg := config.Load()
	if cfg.AppEnv == "production" && (len(cfg.SessionSecret) < 32 || cfg.SessionSecret == "development-only-change-me-before-production") {
		slog.Error("SESSION_SECRET must contain at least 32 characters in production")
		os.Exit(1)
	}
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	store, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database", "err", err)
		os.Exit(1)
	}
	defer store.Close()
	store.CreditMarkup = cfg.CreditMarkup
	if err := store.Migrate(ctx); err != nil {
		slog.Error("migrate", "err", err)
		os.Exit(1)
	}
	seedKeywords, err := market.LoadSeeds(ctx, store, cfg.SeedDir)
	if err != nil {
		slog.Warn("seed load failed", "err", err)
	} else {
		slog.Info("seed data loaded", "keywords", len(seedKeywords))
	}
	if err := store.FailInterrupted(ctx); err != nil {
		slog.Warn("mark interrupted jobs", "err", err)
	}
	if err := os.MkdirAll(cfg.MediaDir, 0o755); err != nil {
		slog.Error("media dir", "err", err)
		os.Exit(1)
	}

	aiKey, aiModel, aiURL := cfg.OpenRouterAPIKey, cfg.OpenRouterModel, cfg.OpenRouterURL
	if cfg.GeminiAPIKey != "" {
		aiKey = cfg.GeminiAPIKey
		aiModel = cfg.GeminiModel
		aiURL = "https://generativelanguage.googleapis.com/v1beta/openai"
	}
	aiClient := ai.New(aiKey, aiModel, aiURL)
	if cfg.MockAI {
		slog.Warn("MOCK_AI=true: using canned campaign content; no AI generation or live research in demo pipeline")
	}
	if !aiClient.Enabled() {
		slog.Warn("OPENROUTER_API_KEY not set: campaigns, videos, editing and chat are disabled")
	}
	mkt := &market.Service{
		Store: store, Scraper: emag.New(), Trends: trends.New(),
		ScraperEnabled: cfg.ScraperEnabled, TrendsEnabled: cfg.TrendsEnabled, CacheTTL: cfg.CacheTTL,
	}
	if cfg.AmazonEnabled {
		mkt.WebSources.Amazon = amazon.New(cfg.AmazonDomain)
	}
	if cfg.RedditEnabled {
		mkt.WebSources.Reddit = reddit.New()
	}
	if cfg.BetaListEnabled {
		mkt.WebSources.BetaList = betalist.New()
	}
	mediaStore := &media.Store{Root: cfg.MediaDir}
	sb := sandbox.New(cfg.WorkerURL)
	campaigns := &campaign.Service{
		Store: store, Market: mkt, AI: aiClient, Media: mediaStore, Sandbox: sb, SeedKeywords: seedKeywords,
		Cfg: campaign.Config{
			MockAI: cfg.MockAI, VideoModel: cfg.VideoModel, VideoResolution: cfg.VideoResolution, VideoAspectRatio: cfg.VideoAspectRatio,
			VideoPollEvery: cfg.VideoPollEvery, EditorModel: cfg.EditorModel,
			PosterModel: cfg.PosterModel, PosterAspect: cfg.PosterAspect,
		},
	}
	if aiClient.Enabled() {
		campaigns.ResumeVideoJobs(ctx)
	}
	srv := &httpapi.Server{
		Cfg: cfg, Store: store, Market: mkt, Campaigns: campaigns, AI: aiClient,
		Media: mediaStore, Sandbox: sb, OpenAPI: backend.OpenAPISpec,
	}

	if err := srv.SeedTestUser(ctx); err != nil {
		slog.Error("test seed failed", "err", err)
		os.Exit(1)
	}
	httpSrv := &http.Server{Addr: ":" + cfg.Port, Handler: srv.Router(), ReadHeaderTimeout: 10 * time.Second}
	go func() {
		slog.Info("listening", "addr", httpSrv.Addr, "model", cfg.OpenRouterModel, "video_model", cfg.VideoModel, "worker", cfg.WorkerURL)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("http", "err", err)
			stop()
		}
	}()
	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutdownCtx)
}
