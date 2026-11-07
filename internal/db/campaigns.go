package db

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/tibi/hackathon/backend/internal/model"
)

// ---- campaigns ----

// CampaignRow is a stored campaign.
type CampaignRow struct {
	ID           uuid.UUID
	CreatedAt    time.Time
	UpdatedAt    time.Time
	Status       string
	Step         string
	Error        string
	ProductName  string
	Keyword      string
	Kit          json.RawMessage
	Market       *model.MarketSnapshot
	Trends       *model.TrendSeries
	AICostUSD    float64
	PagesFetched int
}

// CampaignSummary is a list item.
type CampaignSummary struct {
	ID          uuid.UUID `json:"id"`
	CreatedAt   time.Time `json:"created_at"`
	Status      string    `json:"status"`
	Step        string    `json:"step"`
	ProductName string    `json:"product_name"`
	Keyword     string    `json:"keyword"`
}

// InsertCampaign creates a campaign row.
func (s *Store) InsertCampaign(ctx context.Context, r CampaignRow) error {
	_, err := s.Pool.Exec(ctx, `INSERT INTO campaigns (id, created_at, updated_at, status, step, product_name, keyword, kit) VALUES ($1,$2,$2,$3,$4,$5,$6,$7)`,
		r.ID, r.CreatedAt, r.Status, r.Step, r.ProductName, r.Keyword, []byte(r.Kit))
	return err
}

// UpdateCampaignProgress stores the partially built kit.
func (s *Store) UpdateCampaignProgress(ctx context.Context, id uuid.UUID, status, step, errMsg string, kit json.RawMessage, aiCost float64, pages int) error {
	var e any
	if errMsg != "" {
		e = errMsg
	}
	_, err := s.Pool.Exec(ctx, `UPDATE campaigns SET status=$2, step=$3, error=$4, kit=$5, ai_cost_usd=$6, pages_fetched=$7, updated_at=now() WHERE id=$1`,
		id, status, step, e, []byte(kit), aiCost, pages)
	return err
}

// SetCampaignData stores the raw market data used by the campaign.
func (s *Store) SetCampaignData(ctx context.Context, id uuid.UUID, snap model.MarketSnapshot, ts model.TrendSeries) error {
	mb, _ := json.Marshal(snap)
	tb, _ := json.Marshal(ts)
	_, err := s.Pool.Exec(ctx, `UPDATE campaigns SET market=$2, trends=$3, keyword=$4, updated_at=now() WHERE id=$1`, id, mb, tb, snap.Keyword)
	return err
}

// SetCampaignProduct stores the product name understood by the intake step.
func (s *Store) SetCampaignProduct(ctx context.Context, id uuid.UUID, productName string) error {
	_, err := s.Pool.Exec(ctx, `UPDATE campaigns SET product_name=$2, updated_at=now() WHERE id=$1`, id, productName)
	return err
}

// ResumeCampaign atomically moves a campaign from needs_input back to running
// with the given kit. It returns false if the campaign was not waiting.
func (s *Store) ResumeCampaign(ctx context.Context, id uuid.UUID, kit json.RawMessage) (bool, error) {
	tag, err := s.Pool.Exec(ctx, `UPDATE campaigns SET status='running', step='intake', error=NULL, kit=$2, updated_at=now() WHERE id=$1 AND status='needs_input'`, id, []byte(kit))
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

// AddCampaignAICost adds chat cost to the campaign.
func (s *Store) AddCampaignAICost(ctx context.Context, id uuid.UUID, cost float64) error {
	_, err := s.Pool.Exec(ctx, `UPDATE campaigns SET ai_cost_usd = ai_cost_usd + $2 WHERE id=$1`, id, cost)
	return err
}

// GetCampaign loads a campaign.
func (s *Store) GetCampaign(ctx context.Context, id uuid.UUID) (CampaignRow, error) {
	var r CampaignRow
	var errMsg *string
	var mb, tb []byte
	err := s.Pool.QueryRow(ctx, `SELECT id, created_at, updated_at, status, step, error, product_name, keyword, kit, market, trends, ai_cost_usd, pages_fetched FROM campaigns WHERE id=$1`, id).
		Scan(&r.ID, &r.CreatedAt, &r.UpdatedAt, &r.Status, &r.Step, &errMsg, &r.ProductName, &r.Keyword, &r.Kit, &mb, &tb, &r.AICostUSD, &r.PagesFetched)
	if errors.Is(err, pgx.ErrNoRows) {
		return r, ErrNotFound
	}
	if err != nil {
		return r, err
	}
	if errMsg != nil {
		r.Error = *errMsg
	}
	if len(mb) > 0 {
		r.Market = &model.MarketSnapshot{}
		if err := json.Unmarshal(mb, r.Market); err != nil {
			return r, err
		}
	}
	if len(tb) > 0 {
		r.Trends = &model.TrendSeries{}
		if err := json.Unmarshal(tb, r.Trends); err != nil {
			return r, err
		}
	}
	return r, nil
}

// ListCampaigns returns newest-first summaries and the total count.
func (s *Store) ListCampaigns(ctx context.Context, limit, offset int) ([]CampaignSummary, int, error) {
	var total int
	if err := s.Pool.QueryRow(ctx, `SELECT count(*) FROM campaigns`).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.Pool.Query(ctx, `SELECT id, created_at, status, step, product_name, keyword FROM campaigns ORDER BY created_at DESC LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	items, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (CampaignSummary, error) {
		var c CampaignSummary
		err := row.Scan(&c.ID, &c.CreatedAt, &c.Status, &c.Step, &c.ProductName, &c.Keyword)
		return c, err
	})
	return items, total, err
}

// DeleteCampaign removes a campaign and everything attached.
func (s *Store) DeleteCampaign(ctx context.Context, id uuid.UUID) error {
	tag, err := s.Pool.Exec(ctx, `DELETE FROM campaigns WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// FailInterrupted marks campaigns and edits left running by a previous process as failed.
func (s *Store) FailInterrupted(ctx context.Context) error {
	if _, err := s.Pool.Exec(ctx, `UPDATE campaigns SET status='failed', error='server restarted during generation', updated_at=now() WHERE status='running'`); err != nil {
		return err
	}
	_, err := s.Pool.Exec(ctx, `UPDATE edits SET status='failed', error='server restarted during editing', updated_at=now() WHERE status='running'`)
	return err
}

// ---- assets ----

// Asset is a media file.
type Asset struct {
	ID         uuid.UUID       `json:"id"`
	CampaignID uuid.UUID       `json:"campaign_id"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
	Kind       string          `json:"kind"`
	Role       string          `json:"role,omitempty"`
	Status     string          `json:"status"`
	Name       string          `json:"name"`
	Mime       string          `json:"mime"`
	FilePath   string          `json:"-"`
	SizeBytes  int64           `json:"size_bytes"`
	DurationS  float64         `json:"duration_s"`
	Width      int             `json:"width"`
	Height     int             `json:"height"`
	CostUSD    float64         `json:"cost_usd"`
	Meta       json.RawMessage `json:"meta"`
	Error      string          `json:"error,omitempty"`
	ContentURL string          `json:"content_url"`
}

const assetCols = `id, campaign_id, created_at, updated_at, kind, COALESCE(role,''), status, name, mime, file_path, size_bytes, duration_s, width, height, cost_usd, meta, COALESCE(error,'')`

func scanAsset(row pgx.Row) (Asset, error) {
	var a Asset
	err := row.Scan(&a.ID, &a.CampaignID, &a.CreatedAt, &a.UpdatedAt, &a.Kind, &a.Role, &a.Status, &a.Name, &a.Mime,
		&a.FilePath, &a.SizeBytes, &a.DurationS, &a.Width, &a.Height, &a.CostUSD, &a.Meta, &a.Error)
	a.ContentURL = "/api/assets/" + a.ID.String() + "/content"
	return a, err
}

// InsertAsset creates an asset row.
func (s *Store) InsertAsset(ctx context.Context, a Asset) error {
	if len(a.Meta) == 0 {
		a.Meta = json.RawMessage("{}")
	}
	var role any
	if a.Role != "" {
		role = a.Role
	}
	_, err := s.Pool.Exec(ctx, `INSERT INTO assets (id, campaign_id, kind, role, status, name, mime, file_path, size_bytes, duration_s, width, height, cost_usd, meta)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
		a.ID, a.CampaignID, a.Kind, role, a.Status, a.Name, a.Mime, a.FilePath, a.SizeBytes, a.DurationS, a.Width, a.Height, a.CostUSD, []byte(a.Meta))
	return err
}

// UpdateAsset saves status/file/cost/meta/error.
func (s *Store) UpdateAsset(ctx context.Context, a Asset) error {
	var e any
	if a.Error != "" {
		e = a.Error
	}
	_, err := s.Pool.Exec(ctx, `UPDATE assets SET status=$2, mime=$3, file_path=$4, size_bytes=$5, duration_s=$6, width=$7, height=$8, cost_usd=$9, meta=$10, error=$11, updated_at=now() WHERE id=$1`,
		a.ID, a.Status, a.Mime, a.FilePath, a.SizeBytes, a.DurationS, a.Width, a.Height, a.CostUSD, []byte(a.Meta), e)
	return err
}

// GetAsset loads one asset.
func (s *Store) GetAsset(ctx context.Context, id uuid.UUID) (Asset, error) {
	a, err := scanAsset(s.Pool.QueryRow(ctx, `SELECT `+assetCols+` FROM assets WHERE id=$1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return a, ErrNotFound
	}
	return a, err
}

// ListAssets lists a campaign's assets (oldest first).
func (s *Store) ListAssets(ctx context.Context, campaignID uuid.UUID) ([]Asset, error) {
	rows, err := s.Pool.Query(ctx, `SELECT `+assetCols+` FROM assets WHERE campaign_id=$1 ORDER BY created_at, id`, campaignID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (Asset, error) { return scanAsset(r) })
}

// PendingVideoAssets returns generated clips still waiting on OpenRouter.
func (s *Store) PendingVideoAssets(ctx context.Context) ([]Asset, error) {
	rows, err := s.Pool.Query(ctx, `SELECT `+assetCols+` FROM assets WHERE kind='generated' AND status IN ('pending','in_progress')`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (Asset, error) { return scanAsset(r) })
}

// SumAssetCost sums asset costs by kind for a campaign.
func (s *Store) SumAssetCost(ctx context.Context, campaignID uuid.UUID, kind string) (float64, error) {
	var v float64
	err := s.Pool.QueryRow(ctx, `SELECT COALESCE(sum(cost_usd),0) FROM assets WHERE campaign_id=$1 AND kind=$2`, campaignID, kind).Scan(&v)
	return v, err
}

// ---- edits ----

// EditStep is one entry of the editing log shown to the user.
type EditStep struct {
	At      time.Time `json:"at"`
	Type    string    `json:"type"` // script | result | message | finish | error
	Content string    `json:"content"`
	Data    any       `json:"data,omitempty"`
}

// Edit is an AI video-editing session.
type Edit struct {
	ID            uuid.UUID   `json:"id"`
	CampaignID    uuid.UUID   `json:"campaign_id"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
	Status        string      `json:"status"`
	Instructions  string      `json:"instructions"`
	InputAssetIDs []uuid.UUID `json:"input_asset_ids"`
	Steps         []EditStep  `json:"steps"`
	OutputAssetID *uuid.UUID  `json:"output_asset_id"`
	Title         string      `json:"title,omitempty"`
	Notes         string      `json:"notes,omitempty"`
	CostUSD       float64     `json:"cost_usd"`
	Error         string      `json:"error,omitempty"`
}

const editCols = `id, campaign_id, created_at, updated_at, status, instructions, input_asset_ids, steps, output_asset_id, COALESCE(title,''), COALESCE(notes,''), cost_usd, COALESCE(error,'')`

func scanEdit(row pgx.Row) (Edit, error) {
	var e Edit
	var in, steps []byte
	err := row.Scan(&e.ID, &e.CampaignID, &e.CreatedAt, &e.UpdatedAt, &e.Status, &e.Instructions, &in, &steps, &e.OutputAssetID, &e.Title, &e.Notes, &e.CostUSD, &e.Error)
	if err != nil {
		return e, err
	}
	_ = json.Unmarshal(in, &e.InputAssetIDs)
	_ = json.Unmarshal(steps, &e.Steps)
	if e.InputAssetIDs == nil {
		e.InputAssetIDs = []uuid.UUID{}
	}
	if e.Steps == nil {
		e.Steps = []EditStep{}
	}
	return e, nil
}

// InsertEdit creates an edit session.
func (s *Store) InsertEdit(ctx context.Context, e Edit) error {
	in, _ := json.Marshal(e.InputAssetIDs)
	_, err := s.Pool.Exec(ctx, `INSERT INTO edits (id, campaign_id, status, instructions, input_asset_ids) VALUES ($1,$2,$3,$4,$5)`,
		e.ID, e.CampaignID, e.Status, e.Instructions, in)
	return err
}

// SaveEdit persists the session state.
func (s *Store) SaveEdit(ctx context.Context, e Edit) error {
	steps, _ := json.Marshal(e.Steps)
	var errMsg any
	if e.Error != "" {
		errMsg = e.Error
	}
	_, err := s.Pool.Exec(ctx, `UPDATE edits SET status=$2, steps=$3, output_asset_id=$4, title=$5, notes=$6, cost_usd=$7, error=$8, updated_at=now() WHERE id=$1`,
		e.ID, e.Status, steps, e.OutputAssetID, e.Title, e.Notes, e.CostUSD, errMsg)
	return err
}

// GetEdit loads one edit session.
func (s *Store) GetEdit(ctx context.Context, id uuid.UUID) (Edit, error) {
	e, err := scanEdit(s.Pool.QueryRow(ctx, `SELECT `+editCols+` FROM edits WHERE id=$1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return e, ErrNotFound
	}
	return e, err
}

// ListEdits lists a campaign's edit sessions (newest first).
func (s *Store) ListEdits(ctx context.Context, campaignID uuid.UUID) ([]Edit, error) {
	rows, err := s.Pool.Query(ctx, `SELECT `+editCols+` FROM edits WHERE campaign_id=$1 ORDER BY created_at DESC`, campaignID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(r pgx.CollectableRow) (Edit, error) { return scanEdit(r) })
}

// SumEditCost sums editing (LLM) cost for a campaign.
func (s *Store) SumEditCost(ctx context.Context, campaignID uuid.UUID) (float64, error) {
	var v float64
	err := s.Pool.QueryRow(ctx, `SELECT COALESCE(sum(cost_usd),0) FROM edits WHERE campaign_id=$1`, campaignID).Scan(&v)
	return v, err
}

// ---- chat ----

// ChatMessage is a stored chat message.
type ChatMessage struct {
	ID          int64           `json:"id"`
	CampaignID  uuid.UUID       `json:"campaign_id"`
	Role        string          `json:"role"`
	Content     string          `json:"content"`
	Simulations json.RawMessage `json:"simulations"`
	CostUSD     float64         `json:"cost_usd"`
	CreatedAt   time.Time       `json:"created_at"`
}

// InsertMessage stores a chat message and fills ID/CreatedAt.
func (s *Store) InsertMessage(ctx context.Context, m *ChatMessage) error {
	var sims any
	if len(m.Simulations) > 0 {
		sims = []byte(m.Simulations)
	}
	return s.Pool.QueryRow(ctx, `INSERT INTO chat_messages (campaign_id, role, content, simulations, cost_usd) VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at`,
		m.CampaignID, m.Role, m.Content, sims, m.CostUSD).Scan(&m.ID, &m.CreatedAt)
}

// ListMessages returns the chat history oldest-first.
func (s *Store) ListMessages(ctx context.Context, campaignID uuid.UUID) ([]ChatMessage, error) {
	rows, err := s.Pool.Query(ctx, `SELECT id, campaign_id, role, content, simulations, cost_usd, created_at FROM chat_messages WHERE campaign_id=$1 ORDER BY id`, campaignID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (ChatMessage, error) {
		var m ChatMessage
		var sims []byte
		err := row.Scan(&m.ID, &m.CampaignID, &m.Role, &m.Content, &sims, &m.CostUSD, &m.CreatedAt)
		if len(sims) > 0 {
			m.Simulations = sims
		}
		return m, err
	})
}
