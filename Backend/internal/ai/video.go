package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Video job statuses returned by OpenRouter.
const (
	VideoPending    = "pending"
	VideoInProgress = "in_progress"
	VideoCompleted  = "completed"
	VideoFailed     = "failed"
	VideoCancelled  = "cancelled"
	VideoExpired    = "expired"
)

// VideoRequest is the body of POST /api/v1/videos.
type VideoRequest struct {
	Model       string       `json:"model"`
	Prompt      string       `json:"prompt"`
	Duration    int          `json:"duration,omitempty"`
	Resolution  string       `json:"resolution,omitempty"`
	AspectRatio string       `json:"aspect_ratio,omitempty"`
	FrameImages []FrameImage `json:"frame_images,omitempty"`
	Seed        *int         `json:"seed,omitempty"`
}

// FrameImage is a first/last frame for image-to-video.
type FrameImage struct {
	Type      string `json:"type"` // image_url
	FrameType string `json:"frame_type"`
	ImageURL  struct {
		URL string `json:"url"` // https URL or data: URL
	} `json:"image_url"`
}

// NewFirstFrame builds a first_frame image entry.
func NewFirstFrame(url string) FrameImage {
	f := FrameImage{Type: "image_url", FrameType: "first_frame"}
	f.ImageURL.URL = url
	return f
}

// VideoJob is the poll response.
type VideoJob struct {
	ID           string   `json:"id"`
	GenerationID string   `json:"generation_id"`
	Status       string   `json:"status"`
	Error        string   `json:"error"`
	UnsignedURLs []string `json:"unsigned_urls"`
	Usage        *struct {
		Cost float64 `json:"cost"`
	} `json:"usage"`
}

// SubmitVideo starts a generation job.
func (c *Client) SubmitVideo(ctx context.Context, req VideoRequest) (VideoJob, error) {
	var job VideoJob
	if !c.Enabled() {
		return job, ErrNotConfigured
	}
	b, _ := json.Marshal(req)
	resp, err := c.raw(ctx, http.MethodPost, c.BaseURL+"/videos", bytes.NewReader(b))
	if err != nil {
		return job, err
	}
	defer resp.Body.Close()
	return job, decodeOrError(resp, &job)
}

// PollVideo fetches the job status.
func (c *Client) PollVideo(ctx context.Context, id string) (VideoJob, error) {
	var job VideoJob
	resp, err := c.raw(ctx, http.MethodGet, c.BaseURL+"/videos/"+id, nil)
	if err != nil {
		return job, err
	}
	defer resp.Body.Close()
	return job, decodeOrError(resp, &job)
}

// DownloadVideo streams output `index` of a completed job into w.
func (c *Client) DownloadVideo(ctx context.Context, id string, index int, w io.Writer) (int64, error) {
	resp, err := c.raw(ctx, http.MethodGet, fmt.Sprintf("%s/videos/%s/content?index=%d", c.BaseURL, id, index), nil)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return 0, fmt.Errorf("openrouter: download status %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	return io.Copy(w, io.LimitReader(resp.Body, 500<<20))
}

func (c *Client) raw(ctx context.Context, method, url string, body io.Reader) (*http.Response, error) {
	if !c.Enabled() {
		return nil, ErrNotConfigured
	}
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("HTTP-Referer", "https://github.com/tibi/hackathon")
	req.Header.Set("X-Title", "Merita lansat? - eMAG marketing kit")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openrouter: %w", err)
	}
	return resp, nil
}

func decodeOrError(resp *http.Response, out any) error {
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode >= 300 {
		var e apiError
		if json.Unmarshal(body, &e) == nil && e.Error != nil {
			return fmt.Errorf("openrouter: status %d: %s", resp.StatusCode, e.Error.Message)
		}
		return fmt.Errorf("openrouter: status %d: %s", resp.StatusCode, truncate(strings.TrimSpace(string(body)), 300))
	}
	return json.Unmarshal(body, out)
}

// ---------- video model catalog ----------

// VideoModel describes a video generation model and its estimated price.
type VideoModel struct {
	ID                    string             `json:"id"`
	Name                  string             `json:"name"`
	SupportedDurations    []int              `json:"supported_durations"`
	SupportedResolutions  []string           `json:"supported_resolutions"`
	SupportedAspectRatios []string           `json:"supported_aspect_ratios"`
	SupportedFrameImages  []string           `json:"supported_frame_images"`
	PricePerSecondUSD     map[string]float64 `json:"price_per_second_usd"` // by resolution; empty if token-priced
	ImageInputUSD         float64            `json:"image_input_usd"`
	CheapestPerSecondUSD  *float64           `json:"cheapest_per_second_usd"`
	PricingSKUs           map[string]string  `json:"pricing_skus"`
}

// Supports reports whether the model accepts a duration/aspect/resolution combo.
func (m VideoModel) Supports(duration int, aspect, res string) error {
	if len(m.SupportedDurations) > 0 && !containsInt(m.SupportedDurations, duration) {
		return fmt.Errorf("duration %ds not supported by %s (supported: %v)", duration, m.ID, m.SupportedDurations)
	}
	if len(m.SupportedAspectRatios) > 0 && !containsStr(m.SupportedAspectRatios, aspect) {
		return fmt.Errorf("aspect ratio %s not supported by %s (supported: %v)", aspect, m.ID, m.SupportedAspectRatios)
	}
	if len(m.SupportedResolutions) > 0 && !containsStr(m.SupportedResolutions, res) {
		return fmt.Errorf("resolution %s not supported by %s (supported: %v)", res, m.ID, m.SupportedResolutions)
	}
	return nil
}

// ClosestDuration returns the supported duration closest to d.
func (m VideoModel) ClosestDuration(d int) int {
	if len(m.SupportedDurations) == 0 {
		return d
	}
	best := m.SupportedDurations[0]
	for _, s := range m.SupportedDurations {
		if abs(s-d) < abs(best-d) {
			best = s
		}
	}
	return best
}

// EstimateUSD estimates the price of one clip; ok=false when the model is token-priced.
func (m VideoModel) EstimateUSD(duration int, res string, withImage bool) (float64, bool) {
	p, ok := m.PricePerSecondUSD[res]
	if !ok {
		p, ok = m.PricePerSecondUSD["default"]
	}
	if !ok {
		return 0, false
	}
	cost := p * float64(duration)
	if withImage {
		cost += m.ImageInputUSD
	}
	return cost, true
}

type modelCache struct {
	mu     sync.Mutex
	at     time.Time
	models []VideoModel
}

var videoModels modelCache

// VideoModels returns the catalog sorted by cheapest per-second price (cached 1 h).
func (c *Client) VideoModels(ctx context.Context) ([]VideoModel, error) {
	videoModels.mu.Lock()
	defer videoModels.mu.Unlock()
	if time.Since(videoModels.at) < time.Hour && len(videoModels.models) > 0 {
		return videoModels.models, nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/videos/models", nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openrouter: %w", err)
	}
	defer resp.Body.Close()
	var raw struct {
		Data []struct {
			ID                    string            `json:"id"`
			Name                  string            `json:"name"`
			SupportedDurations    []int             `json:"supported_durations"`
			SupportedResolutions  []string          `json:"supported_resolutions"`
			SupportedAspectRatios []string          `json:"supported_aspect_ratios"`
			SupportedFrameImages  []string          `json:"supported_frame_images"`
			PricingSKUs           map[string]string `json:"pricing_skus"`
		} `json:"data"`
	}
	if err := decodeOrError(resp, &raw); err != nil {
		return nil, err
	}
	out := make([]VideoModel, 0, len(raw.Data))
	for _, d := range raw.Data {
		m := VideoModel{
			ID: d.ID, Name: d.Name, SupportedDurations: d.SupportedDurations, SupportedResolutions: d.SupportedResolutions,
			SupportedAspectRatios: d.SupportedAspectRatios, SupportedFrameImages: d.SupportedFrameImages, PricingSKUs: d.PricingSKUs,
		}
		m.PricePerSecondUSD, m.ImageInputUSD = parseVideoPricing(d.PricingSKUs)
		for _, p := range m.PricePerSecondUSD {
			if m.CheapestPerSecondUSD == nil || p < *m.CheapestPerSecondUSD {
				v := p
				m.CheapestPerSecondUSD = &v
			}
		}
		out = append(out, m)
	}
	sort.SliceStable(out, func(i, j int) bool {
		a, b := out[i].CheapestPerSecondUSD, out[j].CheapestPerSecondUSD
		switch {
		case a == nil:
			return false
		case b == nil:
			return true
		default:
			return *a < *b
		}
	})
	if len(out) == 0 {
		return nil, errors.New("openrouter: no video models returned")
	}
	videoModels.models, videoModels.at = out, time.Now()
	return out, nil
}

// FindVideoModel returns a model by id.
func (c *Client) FindVideoModel(ctx context.Context, id string) (VideoModel, error) {
	ms, err := c.VideoModels(ctx)
	if err != nil {
		return VideoModel{}, err
	}
	for _, m := range ms {
		if m.ID == id {
			return m, nil
		}
	}
	return VideoModel{}, fmt.Errorf("video model %q not found on OpenRouter", id)
}

var resolutions = []string{"360p", "480p", "720p", "768p", "1080p", "1K", "2K", "4K"}

// parseVideoPricing understands the per-second SKU naming used by OpenRouter
// ("cents_per_video_output_second_480p", "duration_seconds_720p", "duration_seconds", …).
// Token-priced SKUs ("video_tokens") are ignored.
func parseVideoPricing(skus map[string]string) (map[string]float64, float64) {
	per := map[string]float64{}
	img := 0.0
	keys := make([]string, 0, len(skus))
	for k := range skus {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		v, err := strconv.ParseFloat(skus[k], 64)
		if err != nil {
			continue
		}
		kl := strings.ToLower(k)
		cents := strings.HasPrefix(kl, "cents_")
		usd := v
		if cents {
			usd = v / 100
		}
		if strings.Contains(kl, "image_input") {
			img = usd
			continue
		}
		if !strings.Contains(kl, "second") || strings.Contains(kl, "long_") || strings.Contains(kl, "continuation") ||
			strings.Contains(kl, "image_to_video") || strings.Contains(kl, "megapixel") {
			continue
		}
		res := "default"
		for _, r := range resolutions {
			if strings.HasSuffix(kl, "_"+strings.ToLower(r)) {
				res = r
			}
		}
		// prefer prices without audio when both exist (we don't need generated audio)
		if old, ok := per[res]; !ok || usd < old {
			per[res] = usd
		}
	}
	return per, img
}

func containsInt(xs []int, x int) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}

func containsStr(xs []string, x string) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
