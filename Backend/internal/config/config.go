// Package config loads runtime configuration from environment variables.
package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	AppEnv, AppURL, APIURL, SessionSecret, StaticDir, MailDir string
	GeminiAPIKey, GeminiModel                                 string
	MockAI, SeedTestUser, AllowTestOTP                        bool
	TestUserEmail, TestUserPassword, TestUserOTP              string
	SMTPHost, SMTPPort, SMTPUser, SMTPPassword, SMTPFrom      string
	GoogleClientID, GoogleClientSecret                        string
	// SeedUsers are normal accounts created when SeedTestUser is true.
	SeedUsers []SeedUser

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
	PosterModel      string
	PosterAspect     string
	// Credits: AI cost × CreditMarkup is deducted from the user's balance.
	CreditMarkup    float64
	SignupCreditUSD float64
	// SeedUserCreditUSD is the balance each seed account is topped up to, once.
	SeedUserCreditUSD float64
	FakePurchases     bool
}

func Load() Config {
	return Config{
		AppEnv: env("APP_ENV", "development"), AppURL: env("APP_URL", "http://localhost:8080"), APIURL: env("API_URL", env("APP_URL", "http://localhost:8080")),
		SessionSecret: env("SESSION_SECRET", "development-only-change-me-before-production"), StaticDir: env("FRONTEND_DIST", env("STATIC_DIR", "../Frontend/dist")), MailDir: env("MAIL_DIR", "data/mail"),
		GeminiAPIKey: env("GEMINI_API_KEY", ""), GeminiModel: env("GEMINI_MODEL", "gemini-2.5-flash"), MockAI: envBool("MOCK_AI", false) || (env("GEMINI_API_KEY", "") == "" && env("OPENROUTER_API_KEY", "") == ""),
		SeedTestUser: envBool("SEED_TEST_USER", false), AllowTestOTP: envBool("ALLOW_TEST_OTP", false), TestUserEmail: env("TEST_USER_EMAIL", "test@campio.app"), TestUserPassword: env("TEST_USER_PASSWORD", ""), TestUserOTP: env("TEST_USER_OTP", "123456"),
		SMTPHost: env("SMTP_HOST", ""), SMTPPort: env("SMTP_PORT", "587"), SMTPUser: env("SMTP_USER", ""), SMTPPassword: env("SMTP_PASSWORD", ""), SMTPFrom: env("SMTP_FROM", "Campio <noreply@campio.app>"),
		GoogleClientID: env("GOOGLE_CLIENT_ID", ""), GoogleClientSecret: env("GOOGLE_CLIENT_SECRET", ""),
		SeedUsers:         seedUsers(),
		Port:              env("PORT", "8080"),
		DatabaseURL:       env("DATABASE_URL", "postgres://hackathon:hackathon@localhost:5432/hackathon?sslmode=disable"),
		OpenRouterAPIKey:  env("OPENROUTER_API_KEY", ""),
		OpenRouterModel:   env("OPENROUTER_MODEL", "google/gemini-2.5-flash"),
		OpenRouterURL:     env("OPENROUTER_URL", "https://openrouter.ai/api/v1"),
		CORSOrigins:       splitList(env("CORS_ORIGINS", "http://localhost:8080,http://localhost:5173")),
		ScraperEnabled:    envBool("SCRAPER_ENABLED", true),
		TrendsEnabled:     envBool("TRENDS_ENABLED", true),
		AmazonEnabled:     envBool("AMAZON_ENABLED", true),
		AmazonDomain:      env("AMAZON_DOMAIN", "www.amazon.de"),
		RedditEnabled:     envBool("REDDIT_ENABLED", true),
		BetaListEnabled:   envBool("BETALIST_ENABLED", true),
		CacheTTL:          envDuration("CACHE_TTL", 24*time.Hour),
		SeedDir:           env("SEED_DIR", "seed"),
		MediaDir:          env("MEDIA_DIR", "data/media"),
		WorkerURL:         env("WORKER_URL", "http://localhost:8001"),
		VideoModel:        env("VIDEO_MODEL", "google/veo-3.1"),
		VideoResolution:   env("VIDEO_RESOLUTION", "480p"),
		VideoAspectRatio:  env("VIDEO_ASPECT_RATIO", "9:16"),
		VideoPollEvery:    envDuration("VIDEO_POLL_EVERY", 10*time.Second),
		EditorModel:       env("EDITOR_MODEL", env("OPENROUTER_MODEL", "google/gemini-2.5-flash")),
		PosterModel:       env("POSTER_MODEL", "google/gemini-2.5-flash-image"),
		PosterAspect:      env("POSTER_ASPECT_RATIO", "4:5"),
		CreditMarkup:      envFloat("CREDIT_MARKUP", 1.0),
		SignupCreditUSD:   envFloat("SIGNUP_CREDIT_USD", 3.0),
		SeedUserCreditUSD: envFloat("SEED_USER_CREDIT_USD", 100.0),
		FakePurchases:     envBool("FAKE_PURCHASES", true),
	}
}

// SeedUser is a normal (non-test) account the seed creates once.
type SeedUser struct{ Email, Password string }

func seedUsers() []SeedUser {
	var out []SeedUser
	for _, n := range []string{"1", "2"} {
		if email := env("SEED_USER_"+n+"_EMAIL", ""); email != "" {
			out = append(out, SeedUser{Email: email, Password: env("SEED_USER_"+n+"_PASSWORD", "")})
		}
	}
	return out
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

func envFloat(k string, def float64) float64 {
	if v, ok := os.LookupEnv(k); ok {
		if f, err := strconv.ParseFloat(v, 64); err == nil && f >= 0 {
			return f
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
