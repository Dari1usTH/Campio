package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// SeedTestUser creates (or updates) the opt-in test account when
// cfg.SeedTestUser is true. It is safe to call on every startup.
func (s *Server) SeedTestUser(ctx context.Context) error {
	if !s.Cfg.SeedTestUser {
		return nil
	}

	email := strings.ToLower(strings.TrimSpace(s.Cfg.TestUserEmail))
	if email == "" {
		slog.Warn("SEED_TEST_USER=true but TEST_USER_EMAIL is empty; skipping")
		return nil
	}

	password := s.Cfg.TestUserPassword
	if password == "" {
		b := make([]byte, 16)
		if _, err := rand.Read(b); err != nil {
			return err
		}
		password = hex.EncodeToString(b)
		slog.Info("test user password (printed once)", "email", email, "password", password)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	_, err = s.Store.Pool.Exec(ctx, `
		INSERT INTO users (id, email, name, password_hash, language, verified, two_factor_enabled, is_test)
		VALUES ($1, $2, $3, $4, 'en', true, false, true)
		ON CONFLICT (email) DO UPDATE
			SET password_hash      = EXCLUDED.password_hash,
			    is_test            = true,
			    verified           = true,
			    two_factor_enabled = false
	`, uuid.New(), email, strings.Split(email, "@")[0], string(hash))

	if err != nil {
		return err
	}

	slog.Info("test user ready", "email", email, "allow_test_otp", s.Cfg.AllowTestOTP)
	return nil
}
