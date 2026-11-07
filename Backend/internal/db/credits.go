package db

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ErrInsufficientCredits is returned when a user cannot afford a paid action.
var ErrInsufficientCredits = errors.New("insufficient credits")

// Credit transaction kinds.
const (
	CreditSignupBonus = "signup_bonus"
	CreditPurchase    = "purchase"
	CreditUsage       = "usage"
)

// CreditTransaction is one ledger row. Positive amounts add credit, negative ones spend it.
type CreditTransaction struct {
	ID          int64      `json:"id"`
	AmountUSD   float64    `json:"amount_usd"`
	Kind        string     `json:"kind"`
	Description string     `json:"description"`
	CampaignID  *uuid.UUID `json:"campaign_id"`
	CreatedAt   time.Time  `json:"created_at"`
}

// markup returns the multiplier applied to AI costs (1 when unset).
func (s *Store) markup() float64 {
	if s.CreditMarkup <= 0 {
		return 1
	}
	return s.CreditMarkup
}

// debit charges the owner of a spend for a cost increase of costDelta (raw
// provider USD; the markup is applied here). Test users and campaigns without
// an owner are never charged. Non-positive deltas are ignored.
func (s *Store) debit(ctx context.Context, tx pgx.Tx, userID *uuid.UUID, costDelta float64, desc string, campaignID *uuid.UUID) error {
	if userID == nil || costDelta <= 0 {
		return nil
	}
	amount := costDelta * s.markup()
	tag, err := tx.Exec(ctx, `UPDATE users SET credit_usd = credit_usd - $2 WHERE id=$1 AND NOT is_test`, *userID, amount)
	if err != nil || tag.RowsAffected() == 0 {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO credit_transactions (user_id, amount_usd, kind, description, campaign_id) VALUES ($1,$2,$3,$4,$5)`,
		*userID, -amount, CreditUsage, desc, campaignID)
	return err
}

// GrantCredit adds credit to a user and records it in the ledger.
func (s *Store) GrantCredit(ctx context.Context, userID uuid.UUID, amountUSD float64, kind, desc string) (float64, error) {
	var balance float64
	err := pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		if err := tx.QueryRow(ctx, `UPDATE users SET credit_usd = credit_usd + $2 WHERE id=$1 RETURNING credit_usd`, userID, amountUSD).Scan(&balance); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrNotFound
			}
			return err
		}
		_, err := tx.Exec(ctx, `INSERT INTO credit_transactions (user_id, amount_usd, kind, description) VALUES ($1,$2,$3,$4)`, userID, amountUSD, kind, desc)
		return err
	})
	return balance, err
}

// ChargeUser deducts an AI cost that is not tied to a campaign.
func (s *Store) ChargeUser(ctx context.Context, userID uuid.UUID, costUSD float64, desc string) error {
	return pgx.BeginFunc(ctx, s.Pool, func(tx pgx.Tx) error {
		return s.debit(ctx, tx, &userID, costUSD, desc, nil)
	})
}

// Balance returns a user's credit in USD.
func (s *Store) Balance(ctx context.Context, userID uuid.UUID) (float64, error) {
	var v float64
	err := s.Pool.QueryRow(ctx, `SELECT credit_usd FROM users WHERE id=$1`, userID).Scan(&v)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, ErrNotFound
	}
	return v, err
}

// CanAfford reports whether the owner of a campaign can pay costUSD (raw
// provider cost, before markup). Test users and ownerless campaigns always can.
func (s *Store) CanAfford(ctx context.Context, campaignID uuid.UUID, costUSD float64) (bool, error) {
	var balance *float64
	var isTest *bool
	err := s.Pool.QueryRow(ctx, `SELECT u.credit_usd, u.is_test FROM campaigns c LEFT JOIN users u ON u.id=c.user_id WHERE c.id=$1`, campaignID).Scan(&balance, &isTest)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, ErrNotFound
	}
	if err != nil {
		return false, err
	}
	if balance == nil || (isTest != nil && *isTest) {
		return true, nil
	}
	return *balance > 0 && *balance >= costUSD*s.markup(), nil
}

// ListCreditTransactions returns the most recent ledger rows of a user.
func (s *Store) ListCreditTransactions(ctx context.Context, userID uuid.UUID, limit int) ([]CreditTransaction, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, amount_usd, kind, description, campaign_id, created_at FROM credit_transactions WHERE user_id=$1 ORDER BY id DESC LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (CreditTransaction, error) {
		var t CreditTransaction
		err := row.Scan(&t.ID, &t.AmountUSD, &t.Kind, &t.Description, &t.CampaignID, &t.CreatedAt)
		return t, err
	})
}

// campaignCostTx locks a campaign row and returns its owner and current AI cost.
func campaignCostTx(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*uuid.UUID, float64, error) {
	var owner *uuid.UUID
	var cost float64
	err := tx.QueryRow(ctx, `SELECT user_id, ai_cost_usd FROM campaigns WHERE id=$1 FOR UPDATE`, id).Scan(&owner, &cost)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, 0, ErrNotFound
	}
	return owner, cost, err
}
