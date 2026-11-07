// Package config loads runtime configuration from environment variables.
package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port             string
	DatabaseURL      string
	OpenRouterAPIKey string
	OpenRouterModel  string
	OpenRouterURL    string
	CORSOrigins      []string
	ScraperEnabled   bool
	TrendsEnabled    bool
	AmazonEnabled    bool
	AmazonDomain     string
	RedditEnabled    bool
	BetaListEnabled  bool
	CacheTTL         time.Duration
	SeedDir          string
	MediaDir         string
	WorkerURL        string
	VideoModel       string
	VideoResolution  string
	VideoAspectRatio string
	VideoPollEvery   time.Duration
	EditorModel      string
}

func Load() Config {
	return Config{
		Port:             env("PORT", "8080"),
		DatabaseURL:      env("DATABASE_URL", "postgres://hackathon:hackathon@localhost:5432/hackathon?sslmode=disable"),
		OpenRouterAPIKey: env("OPENROUTER_API_KEY", ""),
		OpenRouterModel:  env("OPENROUTER_MODEL", "google/gemini-2.5-flash"),
		OpenRouterURL:    env("OPENROUTER_URL", "https://openrouter.ai/api/v1"),
		CORSOrigins:      splitList(env("CORS_ORIGINS", "*")),
		ScraperEnabled:   envBool("SCRAPER_ENABLED", true),
		TrendsEnabled:    envBool("TRENDS_ENABLED", true),
		AmazonEnabled:    envBool("AMAZON_ENABLED", true),
		AmazonDomain:     env("AMAZON_DOMAIN", "www.amazon.de"),
		RedditEnabled:    envBool("REDDIT_ENABLED", true),
		BetaListEnabled:  envBool("BETALIST_ENABLED", true),
		CacheTTL:         envDuration("CACHE_TTL", 24*time.Hour),
		SeedDir:          env("SEED_DIR", "seed"),
		MediaDir:         env("MEDIA_DIR", "data/media"),
		WorkerURL:        env("WORKER_URL", "http://localhost:8001"),
		VideoModel:       env("VIDEO_MODEL", "x-ai/grok-imagine-video-1.5-lite"),
		VideoResolution:  env("VIDEO_RESOLUTION", "480p"),
		VideoAspectRatio: env("VIDEO_ASPECT_RATIO", "9:16"),
		VideoPollEvery:   envDuration("VIDEO_POLL_EVERY", 10*time.Second),
		EditorModel:      env("EDITOR_MODEL", env("OPENROUTER_MODEL", "google/gemini-2.5-flash")),
	}
}

func env(k, def string) string {
	if v, ok := os.LookupEnv(k); ok && v != "" {
		return v
	}
	return def
}

func envBool(k string, def bool) bool {
	if v, ok := os.LookupEnv(k); ok {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return def
}

func envDuration(k string, def time.Duration) time.Duration {
	if v, ok := os.LookupEnv(k); ok {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return def
}

func splitList(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
