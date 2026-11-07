package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net/mail"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// SeedTestUser creates the opt-in accounts when cfg.SeedTestUser is true:
// the test account (TEST_USER_*) and up to two normal accounts
// (SEED_USER_1_* / SEED_USER_2_*). It runs in every APP_ENV, production
// included, and is safe to call on every startup.
func (s *Server) SeedTestUser(ctx context.Context) error {
	if !s.Cfg.SeedTestUser {
		return nil
	}
	if err := s.seedTestAccount(ctx); err != nil {
		return err
	}
	for _, su := range s.Cfg.SeedUsers {
		if err := s.seedNormalUser(ctx, su.Email, su.Password); err != nil {
			return err
		}
	}
	return nil
}

func (s *Server) seedTestAccount(ctx context.Context) error {
	email := strings.ToLower(strings.TrimSpace(s.Cfg.TestUserEmail))
	if email == "" {
		slog.Warn("SEED_TEST_USER=true but TEST_USER_EMAIL is empty; skipping test account")
		return nil
	}
	password, generated := s.Cfg.TestUserPassword, false
	if password == "" {
		b := make([]byte, 16)
		if _, err := rand.Read(b); err != nil {
			return err
		}
		password, generated = hex.EncodeToString(b), true
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	// An explicit TEST_USER_PASSWORD is re-applied on every start. A
	// generated one is only set on creation, so restarts keep the password.
	var inserted bool
	err = s.Store.Pool.QueryRow(ctx, `
		INSERT INTO users (id, email, name, password_hash, language, verified, two_factor_enabled, is_test)
		VALUES ($1, $2, $3, $4, 'en', true, true, true)
		ON CONFLICT (email) DO UPDATE
			SET password_hash      = CASE WHEN $5 THEN users.password_hash ELSE EXCLUDED.password_hash END,
			    is_test            = true,
			    verified           = true,
			    two_factor_enabled = true
		RETURNING xmax = 0
	`, uuid.New(), email, strings.Split(email, "@")[0], string(hash), generated).Scan(&inserted)
	if err != nil {
		return err
	}
	if inserted && generated {
		slog.Info("test user password (printed once)", "email", email, "password", password)
	}
	slog.Info("test user ready", "email", email, "allow_test_otp", s.Cfg.AllowTestOTP)
	return nil
}

// seedNormalUser creates a regular, password-only account: verified, no
// 2FA, charged for AI use, with the signup credit. On later starts only the
// 2FA flag is re-applied; the password is never touched, so one changed in
// the app survives restarts.
func (s *Server) seedNormalUser(ctx context.Context, rawEmail, password string) error {
	address, err := mail.ParseAddress(strings.TrimSpace(rawEmail))
	if err != nil {
		return fmt.Errorf("seed user %q: invalid email", rawEmail)
	}
	email := strings.ToLower(address.Address)
	if len(password) < 12 || len(password) > 72 {
		return fmt.Errorf("seed user %s: password must be 12-72 characters", email)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return err
	}
	var id uuid.UUID
	var inserted bool
	err = s.Store.Pool.QueryRow(ctx, `
		INSERT INTO users (id, email, name, password_hash, language, verified, two_factor_enabled)
		VALUES ($1, $2, $3, $4, 'en', true, false)
		ON CONFLICT (email) DO UPDATE SET two_factor_enabled = false, verified = true
		RETURNING id, xmax = 0
	`, uuid.New(), email, strings.Split(email, "@")[0], string(hash)).Scan(&id, &inserted)
	if err != nil {
		return err
	}
	if inserted {
		s.grantSignupCredit(ctx, id)
		slog.Info("seed user created", "email", email)
	} else {
		slog.Info("seed user already exists; password left unchanged", "email", email)
	}
	return nil
}
