package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"slices"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/tibi/hackathon/backend/internal/db"
)

// creditPacks are the credit amounts (USD) a user can buy.
var creditPacks = []float64{5, 10, 25, 50}

// grantSignupCredit gives a newly created account its welcome credit.
// A failure is logged, not surfaced: the account itself was created.
func (s *Server) grantSignupCredit(ctx context.Context, userID uuid.UUID) {
	if s.Cfg.SignupCreditUSD <= 0 {
		return
	}
	if _, err := s.Store.GrantCredit(ctx, userID, s.Cfg.SignupCreditUSD, db.CreditSignupBonus, "Welcome credit"); err != nil {
		slog.Error("signup credit", "user", userID, "err", err)
	}
}

// requireCredit blocks paid AI actions when the balance is used up.
// Work already running is allowed to finish, so a balance can dip below zero.
func (s *Server) requireCredit(c *gin.Context) {
	u := currentUser(c)
	if !u.IsTest && u.CreditUSD <= 0 {
		failErr(c, db.ErrInsufficientCredits)
		c.Abort()
		return
	}
	c.Next()
}

func (s *Server) billingState(c *gin.Context, u user) {
	balance, err := s.Store.Balance(c.Request.Context(), u.ID)
	if err != nil {
		failErr(c, err)
		return
	}
	txs, err := s.Store.ListCreditTransactions(c.Request.Context(), u.ID, 50)
	if err != nil {
		failErr(c, err)
		return
	}
	markup := s.Cfg.CreditMarkup
	if markup <= 0 {
		markup = 1
	}
	c.JSON(http.StatusOK, gin.H{
		"balance_usd":       balance,
		"markup":            markup,
		"packs_usd":         creditPacks,
		"purchases_enabled": s.Cfg.FakePurchases,
		"unmetered":         u.IsTest,
		"transactions":      txs,
	})
}

// billing returns the balance and recent credit transactions.
func (s *Server) billing(c *gin.Context) { s.billingState(c, currentUser(c)) }

// purchaseCredits adds a credit pack. There is no payment provider yet: when
// FAKE_PURCHASES is on, the pack is granted immediately.
func (s *Server) purchaseCredits(c *gin.Context) {
	if !s.Cfg.FakePurchases {
		fail(c, http.StatusForbidden, "purchases_disabled", "credit purchases are not available yet")
		return
	}
	var req struct {
		PackUSD float64 `json:"pack_usd"`
	}
	if c.ShouldBindJSON(&req) != nil || !slices.Contains(creditPacks, req.PackUSD) {
		fail(c, http.StatusBadRequest, "invalid_request", "pack_usd must be one of the offered packs")
		return
	}
	u := currentUser(c)
	if _, err := s.Store.GrantCredit(c.Request.Context(), u.ID, req.PackUSD, db.CreditPurchase, "Credit purchase"); err != nil {
		failErr(c, err)
		return
	}
	s.billingState(c, u)
}
