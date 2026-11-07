package db

import (
	"context"
	"encoding/json"
	"math"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
)

// testStore connects to TEST_DATABASE_URL (a disposable database) and migrates it.
func testStore(t *testing.T) *Store {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	s, err := Connect(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(s.Close)
	if err := s.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	return s
}

func newTestUser(t *testing.T, s *Store, isTest bool, credit float64) uuid.UUID {
	t.Helper()
	id := uuid.New()
	_, err := s.Pool.Exec(context.Background(), `INSERT INTO users (id, email, name, is_test, credit_usd) VALUES ($1,$2,'t',$3,$4)`, id, id.String()+"@test.local", isTest, credit)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = s.Pool.Exec(context.Background(), `DELETE FROM users WHERE id=$1`, id) })
	return id
}

func newTestCampaign(t *testing.T, s *Store, owner uuid.UUID) uuid.UUID {
	t.Helper()
	id := uuid.New()
	if err := s.InsertCampaign(context.Background(), CampaignRow{ID: id, CreatedAt: time.Now(), Status: "running", Step: "intake", Kit: json.RawMessage("{}"), UserID: owner}); err != nil {
		t.Fatal(err)
	}
	return id
}

func near(a, b float64) bool { return math.Abs(a-b) < 1e-6 }

func TestCreditsDebitedFromCostWrites(t *testing.T) {
	s := testStore(t)
	s.CreditMarkup = 2
	ctx := context.Background()
	u := newTestUser(t, s, false, 3)
	c := newTestCampaign(t, s, u)

	// The pipeline saves its cumulative cost; only the increase is charged.
	for _, cost := range []float64{0.10, 0.10, 0.25} {
		if err := s.UpdateCampaignProgress(ctx, c, "running", "intake", "", json.RawMessage("{}"), cost, 0); err != nil {
			t.Fatal(err)
		}
	}
	if err := s.AddCampaignAICost(ctx, c, 0.05); err != nil {
		t.Fatal(err)
	}
	a := Asset{ID: uuid.New(), CampaignID: c, Kind: "poster", Status: "pending", Name: "p.png", Mime: "image/png", Meta: json.RawMessage("{}")}
	if err := s.InsertAsset(ctx, a); err != nil {
		t.Fatal(err)
	}
	a.CostUSD = 0.20
	if err := s.UpdateAsset(ctx, a); err != nil {
		t.Fatal(err)
	}
	if err := s.UpdateAsset(ctx, a); err != nil { // same cost again: no charge
		t.Fatal(err)
	}
	if err := s.ChargeUser(ctx, u, 0.01, "parse"); err != nil {
		t.Fatal(err)
	}

	spent := (0.25 + 0.05 + 0.20 + 0.01) * 2
	bal, err := s.Balance(ctx, u)
	if err != nil {
		t.Fatal(err)
	}
	if !near(bal, 3-spent) {
		t.Fatalf("balance = %v, want %v", bal, 3-spent)
	}
	txs, err := s.ListCreditTransactions(ctx, u, 50)
	if err != nil {
		t.Fatal(err)
	}
	sum := 0.0
	for _, tx := range txs {
		sum += tx.AmountUSD
	}
	if !near(sum, -spent) || len(txs) != 5 {
		t.Fatalf("ledger sum=%v rows=%d, want %v over 5 rows", sum, len(txs), -spent)
	}

	// 3 - 1.02 = 1.98 left; 0.99 raw × 2 = 1.98 is affordable, 1.00 × 2 is not.
	if ok, _ := s.CanAfford(ctx, c, 0.99); !ok {
		t.Fatal("should afford 0.99")
	}
	if ok, _ := s.CanAfford(ctx, c, 1.00); ok {
		t.Fatal("should not afford 1.00")
	}
}

func TestTestUsersAreNotCharged(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	u := newTestUser(t, s, true, 0)
	c := newTestCampaign(t, s, u)
	if err := s.UpdateCampaignProgress(ctx, c, "running", "intake", "", json.RawMessage("{}"), 5, 0); err != nil {
		t.Fatal(err)
	}
	if bal, _ := s.Balance(ctx, u); bal != 0 {
		t.Fatalf("test user charged: balance %v", bal)
	}
	if ok, _ := s.CanAfford(ctx, c, 100); !ok {
		t.Fatal("test user should always afford")
	}
}

func TestGrantCredit(t *testing.T) {
	s := testStore(t)
	u := newTestUser(t, s, false, 0)
	bal, err := s.GrantCredit(context.Background(), u, 10, CreditPurchase, "pack")
	if err != nil || !near(bal, 10) {
		t.Fatalf("bal=%v err=%v", bal, err)
	}
	if _, err := s.GrantCredit(context.Background(), uuid.New(), 1, CreditPurchase, "x"); err != ErrNotFound {
		t.Fatalf("unknown user: err=%v", err)
	}
}
