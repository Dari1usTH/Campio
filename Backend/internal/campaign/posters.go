package campaign

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg" // DecodeConfig for model output
	_ "image/png"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/tibi/hackathon/backend/internal/ai"
	"github.com/tibi/hackathon/backend/internal/db"
	"github.com/tibi/hackathon/backend/internal/media"
)

// KindPoster is the asset kind of AI-generated posters.
const KindPoster = "poster"

const (
	maxPostersPerCall = 4
	posterTimeout     = 5 * time.Minute
)

// PosterRequest asks for posters: the concepts of the kit, or a free prompt.
type PosterRequest struct {
	ConceptIDs      []string `json:"concept_ids"`
	Prompt          string   `json:"prompt,omitempty"`
	Headline        string   `json:"headline,omitempty"` // overrides the concept's copy when set
	Subline         string   `json:"subline,omitempty"`
	CTA             string   `json:"cta,omitempty"`
	AspectRatio     string   `json:"aspect_ratio,omitempty"`
	Model           string   `json:"model,omitempty"`
	Count           int      `json:"count,omitempty"` // variants per concept / prompt, default 1
	ShowPrice       *bool    `json:"show_price"`
	UseProductImage *bool    `json:"use_product_image"`
}

// PosterMeta is stored in assets.meta for posters.
type PosterMeta struct {
	Model            string `json:"model"`
	Prompt           string `json:"prompt"`       // the scene (concept image_prompt or free prompt)
	ModelPrompt      string `json:"model_prompt"` // the full prompt sent to the image model
	AspectRatio      string `json:"aspect_ratio"`
	ConceptID        string `json:"concept_id,omitempty"`
	Title            string `json:"title,omitempty"`
	Headline         string `json:"headline,omitempty"`
	Subline          string `json:"subline,omitempty"`
	CTA              string `json:"cta,omitempty"`
	Price            string `json:"price,omitempty"`
	UsedProductImage bool   `json:"used_product_image,omitempty"`
}

// GeneratePosters creates one asset per poster and renders each in the background.
func (s *Service) GeneratePosters(ctx context.Context, campaignID uuid.UUID, req PosterRequest) ([]db.Asset, error) {
	if !s.AI.Enabled() {
		return nil, ai.ErrNotConfigured
	}
	k, _, err := s.Get(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	modelID := firstNonEmpty(req.Model, s.Cfg.PosterModel)
	aspect := firstNonEmpty(req.AspectRatio, s.Cfg.PosterAspect, "4:5")
	if !containsStr(ai.PosterAspectRatios, aspect) {
		return nil, invalid("aspect ratio %s not supported (supported: %v)", aspect, ai.PosterAspectRatios)
	}
	im, catalogErr := s.AI.FindImageModel(ctx, modelID)
	if catalogErr != nil && strings.Contains(catalogErr.Error(), "not found") {
		return nil, invalid("%v", catalogErr)
	}
	if catalogErr != nil { // catalog unreachable: assume a Gemini-style model (image + text, accepts images)
		im = ai.ImageModel{ID: modelID, TextOutput: true, ImageInput: true}
	}
	count := req.Count
	if count <= 0 {
		count = 1
	}

	price := ""
	if (req.ShowPrice == nil || *req.ShowPrice) && k.Input.SalePrice > 0 {
		price = money(k.Input.SalePrice) + " lei"
	}
	var metas []PosterMeta
	switch {
	case len(req.ConceptIDs) > 0:
		if k.Content == nil {
			return nil, invalid("the campaign content is not generated yet")
		}
		for _, id := range req.ConceptIDs {
			var pc *ai.PosterConcept
			for i := range k.Content.PosterConcepts {
				if k.Content.PosterConcepts[i].ID == id {
					pc = &k.Content.PosterConcepts[i]
				}
			}
			if pc == nil {
				return nil, invalid("poster concept %q not found", id)
			}
			for range count {
				metas = append(metas, PosterMeta{Prompt: pc.ImagePrompt, ConceptID: pc.ID, Title: pc.Title,
					Headline: firstNonEmpty(req.Headline, pc.Headline), Subline: firstNonEmpty(req.Subline, pc.Subline),
					CTA: firstNonEmpty(req.CTA, pc.CTA), Price: price})
			}
		}
	case strings.TrimSpace(req.Prompt) != "":
		if len(req.Prompt) > 2000 {
			return nil, invalid("prompt too long (max 2000 chars)")
		}
		for range count {
			metas = append(metas, PosterMeta{Prompt: strings.TrimSpace(req.Prompt), Headline: strings.TrimSpace(req.Headline),
				Subline: strings.TrimSpace(req.Subline), CTA: strings.TrimSpace(req.CTA), Price: price})
		}
	default:
		return nil, invalid("concept_ids or prompt is required")
	}
	if len(metas) > maxPostersPerCall {
		return nil, invalid("at most %d posters per request", maxPostersPerCall)
	}

	imageURL := ""
	if (req.UseProductImage == nil || *req.UseProductImage) && im.ImageInput {
		if imageURL, err = s.productImageURL(ctx, campaignID); err != nil {
			return nil, err
		}
	}

	var assets []db.Asset
	for i, m := range metas {
		m.Model, m.AspectRatio, m.UsedProductImage = modelID, aspect, imageURL != ""
		m.ModelPrompt = ai.PosterPrompt(m.Prompt, ai.PosterText{Headline: m.Headline, Subline: m.Subline, CTA: m.CTA, Price: m.Price}, m.UsedProductImage)
		name := "poster.png"
		if m.ConceptID != "" {
			name = m.ConceptID + ".png"
		}
		if len(metas) > 1 {
			name = strings.TrimSuffix(name, ".png") + fmt.Sprintf("-%d.png", i+1)
		}
		a := db.Asset{ID: uuid.New(), CampaignID: campaignID, Kind: KindPoster, Status: StatusPending, Name: name, Mime: "image/png"}
		a.Width, a.Height = posterSize(aspect)
		a.Meta, _ = json.Marshal(m)
		if err := s.Store.InsertAsset(ctx, a); err != nil {
			return assets, err
		}
		s.renderPoster(a, m, im.TextOutput, imageURL)
		assets = append(assets, a)
	}
	return assets, nil
}

func (s *Service) renderPoster(a db.Asset, m PosterMeta, textOutput bool, imageURL string) {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		ctx, cancel := context.WithTimeout(context.Background(), posterTimeout)
		defer cancel()
		a.Status = assetInProgress
		_ = s.Store.UpdateAsset(ctx, a)

		req := ai.ImageRequest{Model: m.Model, Prompt: m.ModelPrompt, AspectRatio: m.AspectRatio, TextOutput: textOutput}
		if imageURL != "" {
			req.RefImages = []string{imageURL}
		}
		img, usage, err := s.AI.GenerateImage(ctx, req)
		a.CostUSD = usage.Cost
		if err == nil {
			err = s.savePoster(&a, img)
		}
		if err != nil {
			slog.Warn("poster generation", "asset", a.ID, "err", err)
			a.Status, a.Error = StatusFailed, err.Error()
		} else {
			a.Status = StatusCompleted
		}
		_ = s.Store.UpdateAsset(context.Background(), a)
	}()
}

func (s *Service) savePoster(a *db.Asset, img ai.GeneratedImage) error {
	ext := map[string]string{"image/jpeg": ".jpg", "image/webp": ".webp"}[img.Mime]
	if ext == "" {
		ext = ".png"
	}
	rel := media.Rel(a.CampaignID.String(), a.ID.String()+ext)
	f, err := s.Media.Create(rel)
	if err != nil {
		return err
	}
	if _, err := f.Write(img.Data); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	a.FilePath, a.Mime, a.SizeBytes = rel, img.Mime, int64(len(img.Data))
	a.Name = strings.TrimSuffix(a.Name, ".png") + ext
	if cfg, _, err := image.DecodeConfig(bytes.NewReader(img.Data)); err == nil {
		a.Width, a.Height = cfg.Width, cfg.Height
	}
	return nil
}

// posterSize is a placeholder size from the aspect ratio (long side 1024), replaced
// by the real pixel size once the image is decoded.
func posterSize(aspect string) (int, int) {
	var w, h int
	if _, err := fmt.Sscanf(aspect, "%d:%d", &w, &h); err != nil || w <= 0 || h <= 0 {
		return 0, 0
	}
	if w >= h {
		return 1024, 1024 * h / w
	}
	return 1024 * w / h, 1024
}
