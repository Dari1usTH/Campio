package campaign

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/tibi/hackathon/backend/internal/ai"
	"github.com/tibi/hackathon/backend/internal/analysis"
	"github.com/tibi/hackathon/backend/internal/db"
	"github.com/tibi/hackathon/backend/internal/media"
)

// Asset kinds and upload roles.
const (
	KindGenerated = "generated"
	KindEdited    = "edited"
	KindUpload    = "upload"

	RoleProductImage = "product_image"
	RoleLogo         = "logo"
	RoleMusic        = "music"
	RoleFootage      = "footage"

	assetInProgress = "in_progress"
	maxClipsPerCall = 6
	videoTimeout    = 30 * time.Minute

	maxClipPromptChars  = 2000
	maxCaptionChars     = 80
	defaultCustomClipS  = 8
	captionBurnTimeoutS = 120
)

// VideoRequest asks for clips: either the shots of a concept, or a free prompt.
type VideoRequest struct {
	ConceptID       string `json:"concept_id"`
	ShotIndexes     []int  `json:"shot_indexes"`
	Prompt          string `json:"prompt,omitempty"`
	Caption         string `json:"caption,omitempty"` // on-screen text burned into a custom clip
	DurationS       int    `json:"duration_s"`
	AspectRatio     string `json:"aspect_ratio"`
	Resolution      string `json:"resolution,omitempty"`
	Model           string `json:"model,omitempty"`
	UseProductImage *bool  `json:"use_product_image"`
}

// VideoMeta is stored in assets.meta for generated clips.
type VideoMeta struct {
	Model            string  `json:"model"`
	Prompt           string  `json:"prompt"`
	DurationS        int     `json:"duration_s,omitempty"`
	Resolution       string  `json:"resolution"`
	AspectRatio      string  `json:"aspect_ratio,omitempty"`
	ConceptID        string  `json:"concept_id,omitempty"`
	ShotIndex        *int    `json:"shot_index,omitempty"`
	Caption          string  `json:"caption,omitempty"`
	CaptionBurned    bool    `json:"caption_burned,omitempty"`
	UsedProductImage bool    `json:"used_product_image,omitempty"`
	JobID            string  `json:"openrouter_job_id,omitempty"`
	EstimatedCostUSD float64 `json:"estimated_cost_usd,omitempty"`
	Title            string  `json:"title,omitempty"`
	Notes            string  `json:"notes,omitempty"`
	EditID           string  `json:"edit_id,omitempty"`
}

type clipSpec struct {
	prompt    string
	duration  int
	caption   string
	shotIndex *int
	withImage bool
}

// GenerateVideos submits one OpenRouter job per clip and polls them in the background.
func (s *Service) GenerateVideos(ctx context.Context, campaignID uuid.UUID, req VideoRequest) ([]db.Asset, float64, error) {
	if !s.AI.Enabled() {
		return nil, 0, ai.ErrNotConfigured
	}
	k, _, err := s.Get(ctx, campaignID)
	if err != nil {
		return nil, 0, err
	}
	modelID := firstNonEmpty(req.Model, s.Cfg.VideoModel)
	aspect := firstNonEmpty(req.AspectRatio, s.Cfg.VideoAspectRatio)
	res := firstNonEmpty(req.Resolution, s.Cfg.VideoResolution)
	vm, catalogErr := s.AI.FindVideoModel(ctx, modelID)
	if catalogErr != nil && strings.Contains(catalogErr.Error(), "not found") {
		return nil, 0, invalid("%v", catalogErr)
	}

	var specs []clipSpec
	switch {
	case req.ConceptID != "":
		if k.Content == nil {
			return nil, 0, invalid("the campaign content is not generated yet")
		}
		var concept *ai.VideoConcept
		for i := range k.Content.VideoConcepts {
			if k.Content.VideoConcepts[i].ID == req.ConceptID {
				concept = &k.Content.VideoConcepts[i]
			}
		}
		if concept == nil {
			return nil, 0, invalid("video concept %q not found", req.ConceptID)
		}
		idx := req.ShotIndexes
		if len(idx) == 0 {
			for i := range concept.Shots {
				idx = append(idx, i)
			}
		}
		for _, i := range idx {
			if i < 0 || i >= len(concept.Shots) {
				return nil, 0, invalid("shot index %d out of range (concept has %d shots)", i, len(concept.Shots))
			}
			sh := concept.Shots[i]
			ii := i
			d := sh.DurationS
			if req.DurationS > 0 {
				d = req.DurationS
			}
			specs = append(specs, clipSpec{prompt: sh.VideoPrompt, duration: d, caption: sh.Caption, shotIndex: &ii, withImage: i == 0})
		}
	case strings.TrimSpace(req.Prompt) != "":
		prompt, caption := strings.TrimSpace(req.Prompt), strings.TrimSpace(req.Caption)
		if n := utf8.RuneCountInString(prompt); n > maxClipPromptChars {
			return nil, 0, invalid("prompt is too long (%d characters, max %d)", n, maxClipPromptChars)
		}
		if n := utf8.RuneCountInString(caption); n > maxCaptionChars {
			return nil, 0, invalid("caption is too long (%d characters, max %d)", n, maxCaptionChars)
		}
		d := req.DurationS
		if d <= 0 {
			d = defaultCustomClipS
		}
		specs = append(specs, clipSpec{prompt: prompt, duration: d, caption: caption, withImage: true})
	default:
		return nil, 0, invalid("concept_id or prompt is required")
	}
	if len(specs) > maxClipsPerCall {
		return nil, 0, invalid("at most %d clips per request", maxClipsPerCall)
	}

	useImage := req.UseProductImage == nil || *req.UseProductImage
	imageURL := ""
	if useImage && (catalogErr != nil || containsStr(vm.SupportedFrameImages, "first_frame")) {
		imageURL, err = s.productImageURL(ctx, campaignID)
		if err != nil {
			return nil, 0, err
		}
	}

	var assets []db.Asset
	total := 0.0
	for _, sp := range specs {
		if catalogErr == nil {
			sp.duration = vm.ClosestDuration(sp.duration)
			if err := vm.Supports(sp.duration, aspect, res); err != nil {
				return nil, 0, invalid("%v", err)
			}
		}
		withImage := sp.withImage && imageURL != ""
		meta := VideoMeta{Model: modelID, Prompt: sp.prompt, DurationS: sp.duration, Resolution: res, AspectRatio: aspect,
			ConceptID: req.ConceptID, ShotIndex: sp.shotIndex, Caption: sp.caption, UsedProductImage: withImage}
		if est, ok := vm.EstimateUSD(sp.duration, res, withImage); ok {
			meta.EstimatedCostUSD = analysis.Round6(est)
			total += est
		}
		name := "custom.mp4"
		if req.ConceptID != "" && sp.shotIndex != nil {
			name = fmt.Sprintf("%s-shot%d.mp4", req.ConceptID, *sp.shotIndex+1)
		} else {
			meta.Title = "Clip personalizat"
		}
		a := db.Asset{ID: uuid.New(), CampaignID: campaignID, Kind: KindGenerated, Status: StatusPending, Name: name, Mime: "video/mp4", DurationS: float64(sp.duration)}

		vreq := ai.VideoRequest{Model: modelID, Prompt: sp.prompt, Duration: sp.duration, Resolution: res, AspectRatio: aspect}
		if withImage {
			vreq.FrameImages = []ai.FrameImage{ai.NewFirstFrame(imageURL)}
		}
		job, err := s.AI.SubmitVideo(ctx, vreq)
		if err != nil {
			a.Status, a.Error = StatusFailed, err.Error()
		} else {
			meta.JobID = job.ID
		}
		a.Meta, _ = json.Marshal(meta)
		if err := s.Store.InsertAsset(ctx, a); err != nil {
			return assets, total, err
		}
		if a.Status != StatusFailed {
			s.watchVideo(a)
		}
		assets = append(assets, a)
	}
	return assets, analysis.Round6(total), nil
}

// ResumeVideoJobs restarts polling for clips that were in flight when the server stopped.
func (s *Service) ResumeVideoJobs(ctx context.Context) {
	assets, err := s.Store.PendingVideoAssets(ctx)
	if err != nil {
		slog.Warn("resume video jobs", "err", err)
		return
	}
	for _, a := range assets {
		s.watchVideo(a)
	}
	if len(assets) > 0 {
		slog.Info("resumed video jobs", "count", len(assets))
	}
}

func (s *Service) watchVideo(a db.Asset) {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.pollVideo(a)
	}()
}

func (s *Service) pollVideo(a db.Asset) {
	ctx, cancel := context.WithTimeout(context.Background(), videoTimeout)
	defer cancel()
	var meta VideoMeta
	_ = json.Unmarshal(a.Meta, &meta)
	every := s.Cfg.VideoPollEvery
	if every <= 0 {
		every = 10 * time.Second
	}
	fail := func(msg string) {
		a.Status, a.Error = StatusFailed, msg
		_ = s.Store.UpdateAsset(context.Background(), a)
	}
	for {
		select {
		case <-ctx.Done():
			fail("timed out waiting for the video model")
			return
		case <-time.After(every):
		}
		job, err := s.AI.PollVideo(ctx, meta.JobID)
		if err != nil {
			slog.Warn("poll video", "asset", a.ID, "err", err)
			continue // transient; keep polling until timeout
		}
		if job.Usage != nil {
			a.CostUSD = job.Usage.Cost
		}
		switch job.Status {
		case ai.VideoPending:
		case ai.VideoInProgress:
			if a.Status != assetInProgress {
				a.Status = assetInProgress
				_ = s.Store.UpdateAsset(ctx, a)
			}
		case ai.VideoCompleted:
			rel := media.Rel(a.CampaignID.String(), a.ID.String()+".mp4")
			f, err := s.Media.Create(rel)
			if err != nil {
				fail(err.Error())
				return
			}
			n, err := s.AI.DownloadVideo(ctx, meta.JobID, 0, f)
			f.Close()
			if err != nil {
				os.Remove(s.Media.Path(rel))
				fail(err.Error())
				return
			}
			a.FilePath, a.SizeBytes = rel, n
			if meta.Caption != "" && s.Sandbox != nil {
				if size, err := s.burnCaption(ctx, s.Media.Path(rel), meta.Caption); err != nil {
					slog.Warn("burn caption; keeping the raw clip", "asset", a.ID, "err", err)
				} else {
					a.SizeBytes, meta.CaptionBurned = size, true
					a.Meta, _ = json.Marshal(meta)
				}
			}
			a.Status = StatusCompleted
			a.Width, a.Height = frameSize(meta.Resolution, meta.AspectRatio)
			_ = s.Store.UpdateAsset(context.Background(), a)
			return
		default: // failed | cancelled | expired
			msg := job.Error
			if msg == "" {
				msg = "video job " + job.Status
			}
			fail(msg)
			return
		}
	}
}

// burnCaption overlays caption on the clip at path (in place) using the video worker.
func (s *Service) burnCaption(ctx context.Context, path, caption string) (int64, error) {
	script := fmt.Sprintf(`import base64
from vidkit import *
text = base64.b64decode("%s").decode("utf-8")
info = probe("in/clip.mp4")
d = info["duration"] or 5.0
size = max(24, round((info["width"] or 720) * 0.065))
captions("in/clip.mp4", "out/clip.mp4", [(min(0.3, d / 4), max(d - 0.3, d * 3 / 4), text)], position="bottom", size=size)
`, base64.StdEncoding.EncodeToString([]byte(caption)))
	res, err := s.Sandbox.Run(ctx, script, map[string]string{"clip.mp4": path}, captionBurnTimeoutS)
	if err != nil {
		return 0, err
	}
	if res.ExitCode != 0 || res.TimedOut {
		return 0, fmt.Errorf("caption script failed (exit %d, timed out %v): %s", res.ExitCode, res.TimedOut, truncateStr(res.Stderr, 500))
	}
	for _, o := range res.Outputs {
		if o.Name == "clip.mp4" && len(o.Data) > 0 {
			tmp := path + ".tmp"
			if err := os.WriteFile(tmp, o.Data, 0o644); err != nil {
				return 0, err
			}
			if err := os.Rename(tmp, path); err != nil {
				os.Remove(tmp)
				return 0, err
			}
			return int64(len(o.Data)), nil
		}
	}
	return 0, errors.New("caption script produced no output")
}

func truncateStr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[len(s)-n:]
}

// productImageURL returns the image used as first frame: the latest uploaded
// product image (as a data URL), or "" when there is none.
func (s *Service) productImageURL(ctx context.Context, campaignID uuid.UUID) (string, error) {
	assets, err := s.Store.ListAssets(ctx, campaignID)
	if err != nil {
		return "", err
	}
	for i := len(assets) - 1; i >= 0; i-- {
		a := assets[i]
		if a.Kind == KindUpload && a.Role == RoleProductImage && a.Status == StatusCompleted {
			b, err := os.ReadFile(s.Media.Path(a.FilePath))
			if err != nil {
				return "", err
			}
			if len(b) > 8<<20 {
				return "", errors.New("product image larger than 8 MB")
			}
			return "data:" + a.Mime + ";base64," + base64.StdEncoding.EncodeToString(b), nil
		}
	}
	return "", nil
}

// frameSize estimates pixel size from resolution + aspect ratio (e.g. 480p 9:16 → 480x854).
func frameSize(res, aspect string) (int, int) {
	short := map[string]int{"360p": 360, "480p": 480, "720p": 720, "768p": 768, "1080p": 1080, "1K": 1080, "2K": 1440, "4K": 2160}[res]
	var a, b int
	if _, err := fmt.Sscanf(aspect, "%d:%d", &a, &b); err != nil || short == 0 || a == 0 || b == 0 {
		return 0, 0
	}
	if a >= b {
		return short * a / b, short
	}
	return short, short * b / a
}

func firstNonEmpty(v ...string) string {
	for _, s := range v {
		if strings.TrimSpace(s) != "" {
			return strings.TrimSpace(s)
		}
	}
	return ""
}

func containsStr(xs []string, x string) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}
