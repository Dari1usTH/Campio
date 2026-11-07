// Package httpapi exposes the REST API with Gin.
package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/tibi/hackathon/backend/internal/ai"
	"github.com/tibi/hackathon/backend/internal/analysis"
	"github.com/tibi/hackathon/backend/internal/campaign"
	"github.com/tibi/hackathon/backend/internal/config"
	"github.com/tibi/hackathon/backend/internal/db"
	"github.com/tibi/hackathon/backend/internal/market"
	"github.com/tibi/hackathon/backend/internal/media"
	"github.com/tibi/hackathon/backend/internal/sandbox"
)

// Server holds handler dependencies.
type Server struct {
	Cfg       config.Config
	Store     *db.Store
	Market    *market.Service
	Campaigns *campaign.Service
	AI        *ai.Client
	Media     *media.Store
	Sandbox   *sandbox.Client
	OpenAPI   []byte
}

// Router builds the Gin engine.
func (s *Server) Router() *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.MaxMultipartMemory = 16 << 20

	cc := cors.Config{
		AllowMethods:  []string{"GET", "POST", "DELETE", "OPTIONS"},
		AllowHeaders:  []string{"Origin", "Content-Type", "Accept", "Authorization", "Range"},
		ExposeHeaders: []string{"Content-Length", "Content-Range", "Accept-Ranges"},
		MaxAge:        12 * time.Hour,
	}
	if len(s.Cfg.CORSOrigins) == 0 || (len(s.Cfg.CORSOrigins) == 1 && s.Cfg.CORSOrigins[0] == "*") {
		cc.AllowAllOrigins = true
	} else {
		cc.AllowOrigins = s.Cfg.CORSOrigins
	}
	r.Use(cors.New(cc))

	api := r.Group("/api")
	api.GET("/health", s.health)
	api.GET("/openapi.yaml", s.openapi)
	api.GET("/docs", s.docs)
	api.GET("/methodology", s.methodology)
	api.GET("/demo-cases", s.demoCases)
	api.GET("/market", s.getMarket)
	api.GET("/trends", s.getTrends)
	api.GET("/video-models", s.videoModels)

	api.POST("/campaigns", s.createCampaign)
	api.GET("/campaigns", s.listCampaigns)
	api.GET("/campaigns/:id", s.getCampaign)
	api.DELETE("/campaigns/:id", s.deleteCampaign)
	api.POST("/campaigns/:id/budget-simulation", s.simulateBudget)
	api.GET("/campaigns/:id/messages", s.listMessages)
	api.POST("/campaigns/:id/messages", s.postMessage)

	api.GET("/campaigns/:id/assets", s.listAssets)
	api.POST("/campaigns/:id/uploads", s.upload)
	api.POST("/campaigns/:id/videos", s.generateVideos)
	api.GET("/campaigns/:id/edits", s.listEdits)
	api.POST("/campaigns/:id/edits", s.startEdit)
	api.GET("/assets/:id", s.getAsset)
	api.GET("/assets/:id/content", s.assetContent)
	api.GET("/edits/:id", s.getEdit)

	r.NoRoute(func(c *gin.Context) { fail(c, http.StatusNotFound, "not_found", "route not found") })
	return r
}

// ---- errors ----

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func fail(c *gin.Context, status int, code, msg string) {
	c.AbortWithStatusJSON(status, gin.H{"error": apiError{Code: code, Message: msg}})
}

func failErr(c *gin.Context, err error) {
	switch {
	case errors.Is(err, db.ErrNotFound):
		fail(c, http.StatusNotFound, "not_found", "resource not found")
	case errors.Is(err, campaign.ErrNotReady):
		fail(c, http.StatusConflict, "not_ready", strings.TrimPrefix(err.Error(), "invalid request: "))
	case errors.Is(err, campaign.ErrInvalid):
		fail(c, http.StatusBadRequest, "invalid_request", strings.TrimPrefix(err.Error(), "invalid request: "))
	case errors.Is(err, market.ErrNoData):
		fail(c, http.StatusUnprocessableEntity, "no_market_data", err.Error())
	case errors.Is(err, ai.ErrNotConfigured):
		fail(c, http.StatusServiceUnavailable, "ai_unavailable", err.Error())
	case errors.Is(err, context.DeadlineExceeded):
		fail(c, http.StatusGatewayTimeout, "timeout", err.Error())
	case strings.HasPrefix(err.Error(), "openrouter"):
		fail(c, http.StatusBadGateway, "ai_error", err.Error())
	default:
		fail(c, http.StatusInternalServerError, "internal", err.Error())
	}
}

func parseID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		fail(c, http.StatusBadRequest, "invalid_request", "id must be a UUID")
		return id, false
	}
	return id, true
}

// ---- meta ----

func (s *Server) health(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	defer cancel()
	dbStatus := "ok"
	if err := s.Store.Pool.Ping(ctx); err != nil {
		dbStatus = "error: " + err.Error()
	}
	workerStatus := "ok"
	if err := s.Sandbox.Health(ctx); err != nil {
		workerStatus = "error: " + err.Error()
	}
	status := http.StatusOK
	if dbStatus != "ok" {
		status = http.StatusServiceUnavailable
	}
	c.JSON(status, gin.H{
		"status":          map[bool]string{true: "ok", false: "degraded"}[dbStatus == "ok"],
		"database":        dbStatus,
		"video_worker":    workerStatus,
		"ai_configured":   s.AI.Enabled(),
		"ai_model":        s.AI.Model,
		"video_model":     s.Cfg.VideoModel,
		"editor_model":    s.Cfg.EditorModel,
		"scraper_enabled": s.Cfg.ScraperEnabled,
		"trends_enabled":  s.Cfg.TrendsEnabled,
	})
}

func (s *Server) openapi(c *gin.Context) {
	c.Data(http.StatusOK, "application/yaml; charset=utf-8", s.OpenAPI)
}

func (s *Server) docs(c *gin.Context) {
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(`<!doctype html><html><head><title>API docs</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css"></head>
<body><div id="ui"></div><script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:'/api/openapi.yaml',dom_id:'#ui'})</script></body></html>`))
}

func (s *Server) methodology(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"principle":          "Datele de piață, bugetele, afișările, click-urile, comenzile estimate și dimensiunea testelor A/B sunt calculate determinist în cod. AI-ul alege strategia și scrie textele; video-urile sunt generate de un model video și montate de un AI care scrie scripturi Python rulate într-un sandbox izolat.",
		"channel_benchmarks": analysis.Benchmarks,
		"constants": gin.H{
			"campaign_weeks":             analysis.CampaignWeeks,
			"review_rate":                analysis.ReviewRate,
			"review_lifetime_months":     analysis.ReviewLifetimeMonths,
			"ab_alpha_two_sided":         0.05,
			"ab_power":                   0.8,
			"ab_min_detectable_lift_pct": analysis.DefaultMinDetectableLift,
			"usd_to_ron":                 analysis.USDToRON,
			"scraper_cost_per_page_usd":  analysis.ScraperCostPerPageUSD,
		},
		"steps": []string{
			"Piața: prima pagină de rezultate eMAG (~60 produse) + 8 pagini de produs (vânzător, recenzii) + Google Trends RO pe 5 ani.",
			"Strategie (AI): nemulțumiri extrase din recenzii, 2-3 persona, poziționare (nemulțumire → mesaj).",
			"Conținut (AI): titluri și descriere de listing, 3-5 reclame, postări social media, idei de imagini, concepte video cu shot-uri.",
			"Plan (AI + cod): AI-ul propune canalele și procentele; codul normalizează la 100%, împarte bugetul pe 4 săptămâni și estimează afișări = buget/CPM×1000, click-uri = afișări×CTR, comenzi = click-uri×CVR, venit = comenzi×preț.",
			"Teste A/B (AI + cod): AI-ul propune mesajele A și B; codul calculează eșantionul per variantă (test z pe două proporții, α=0.05, putere 80%, detectăm +30% relativ), costul și numărul de zile la bugetul canalului.",
			"Video: fiecare shot = un clip generat de un model video OpenRouter (implicit cel mai ieftin potrivit pentru 9:16); editorul AI montează clipurile cu captions și end card.",
		},
	})
}

// ---- market ----

func (s *Server) getMarket(c *gin.Context) {
	kw := strings.TrimSpace(c.Query("keyword"))
	if kw == "" {
		fail(c, http.StatusBadRequest, "invalid_request", "keyword is required")
		return
	}
	snap, err := s.Market.Snapshot(c.Request.Context(), kw)
	if err != nil {
		failErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"keyword": snap.Keyword, "source": snap.Source, "fetched_at": snap.FetchedAt, "fallback_note": snap.FallbackNote,
		"stats": analysis.ComputeMarket(snap), "products": nonNil(snap.Products), "reviews": nonNil(snap.Reviews),
	})
}

func (s *Server) getTrends(c *gin.Context) {
	kw := strings.TrimSpace(c.Query("keyword"))
	if kw == "" {
		fail(c, http.StatusBadRequest, "invalid_request", "keyword is required")
		return
	}
	ts := s.Market.Trend(c.Request.Context(), kw)
	c.JSON(http.StatusOK, gin.H{
		"keyword": ts.Keyword, "geo": ts.Geo, "source": ts.Source, "fetched_at": ts.FetchedAt, "fallback_note": ts.FallbackNote,
		"stats": analysis.ComputeTrend(ts), "points": nonNil(ts.Points),
	})
}

func (s *Server) videoModels(c *gin.Context) {
	ms, err := s.AI.VideoModels(c.Request.Context())
	if err != nil {
		failErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"default_model": s.Cfg.VideoModel, "default_resolution": s.Cfg.VideoResolution,
		"default_aspect_ratio": s.Cfg.VideoAspectRatio, "items": ms})
}

func nonNil[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}

func atoiDefault(s string, def, lo, hi int) int {
	v, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return max(lo, min(hi, v))
}
