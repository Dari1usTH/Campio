package ai

import (
	"bytes"
	"context"
	"encoding/base64"
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

// PosterAspectRatios are the aspect ratios accepted for posters (what OpenRouter's
// image_config.aspect_ratio supports across image models).
var PosterAspectRatios = []string{"1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9"}

// ImageRequest asks an image model for one picture.
type ImageRequest struct {
	Model       string
	Prompt      string
	AspectRatio string
	// RefImages are reference pictures (https or data: URLs), e.g. the real product photo.
	RefImages []string
	// TextOutput reports whether the model also outputs text; such models need
	// modalities ["image","text"], image-only models need ["image"].
	TextOutput bool
}

// GeneratedImage is the decoded output of an image model.
type GeneratedImage struct {
	Data []byte
	Mime string
}

// GenerateImage calls chat completions with image output and returns the first image.
func (c *Client) GenerateImage(ctx context.Context, req ImageRequest) (GeneratedImage, Usage, error) {
	if !c.Enabled() {
		return GeneratedImage{}, Usage{}, ErrNotConfigured
	}
	parts := []ContentPart{TextPart(req.Prompt)}
	for _, u := range req.RefImages {
		parts = append(parts, ImagePart(u))
	}
	modalities := []string{"image"}
	if req.TextOutput {
		modalities = []string{"image", "text"}
	}
	body := map[string]any{
		"model":      req.Model,
		"messages":   []Message{{Role: "user", Parts: parts}},
		"modalities": modalities,
		"usage":      map[string]bool{"include": true},
	}
	if req.AspectRatio != "" {
		body["image_config"] = map[string]string{"aspect_ratio": req.AspectRatio}
	}
	b, err := json.Marshal(body)
	if err != nil {
		return GeneratedImage{}, Usage{}, err
	}
	resp, err := c.raw(ctx, http.MethodPost, c.BaseURL+"/chat/completions", bytes.NewReader(b))
	if err != nil {
		return GeneratedImage{}, Usage{}, err
	}
	defer resp.Body.Close()
	var out struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
				Images  []struct {
					ImageURL ImageURL `json:"image_url"`
				} `json:"images"`
			} `json:"message"`
		} `json:"choices"`
		Usage Usage `json:"usage"`
	}
	if err := decodeImageResponse(resp, &out); err != nil {
		return GeneratedImage{}, Usage{}, err
	}
	for _, ch := range out.Choices {
		for _, im := range ch.Message.Images {
			img, err := decodeDataURL(im.ImageURL.URL)
			if err != nil {
				return GeneratedImage{}, out.Usage, err
			}
			return img, out.Usage, nil
		}
	}
	msg := "the model returned no image"
	if len(out.Choices) > 0 && strings.TrimSpace(out.Choices[0].Message.Content) != "" {
		msg += ": " + truncate(strings.TrimSpace(out.Choices[0].Message.Content), 300)
	}
	return GeneratedImage{}, out.Usage, errors.New(msg)
}

// decodeImageResponse is decodeOrError with a larger limit: images arrive inline as base64.
func decodeImageResponse(resp *http.Response, out any) error {
	body, err := io.ReadAll(io.LimitReader(resp.Body, 64<<20))
	if err != nil {
		return err
	}
	var e apiError
	if json.Unmarshal(body, &e) == nil && e.Error != nil {
		return fmt.Errorf("openrouter: status %d: %s", resp.StatusCode, e.Error.Message)
	}
	if resp.StatusCode >= 300 {
		return fmt.Errorf("openrouter: status %d: %s", resp.StatusCode, truncate(strings.TrimSpace(string(body)), 300))
	}
	return json.Unmarshal(body, out)
}

func decodeDataURL(u string) (GeneratedImage, error) {
	rest, ok := strings.CutPrefix(u, "data:")
	if !ok {
		return GeneratedImage{}, errors.New("image model returned a non-inline image URL")
	}
	meta, data, ok := strings.Cut(rest, ",")
	if !ok || !strings.HasSuffix(meta, ";base64") {
		return GeneratedImage{}, errors.New("image model returned a malformed data URL")
	}
	b, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return GeneratedImage{}, fmt.Errorf("decode image: %w", err)
	}
	mime := strings.TrimSuffix(meta, ";base64")
	if !strings.HasPrefix(mime, "image/") {
		mime = http.DetectContentType(b)
	}
	return GeneratedImage{Data: b, Mime: mime}, nil
}

// ---------- image model catalog ----------

// ImageModel is a model that can output images.
type ImageModel struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	TextOutput bool   `json:"text_output"`
	ImageInput bool   `json:"image_input"`
	// Per-unit prices in USD as published by OpenRouter (strings in the API, parsed here).
	PromptUSD     float64 `json:"prompt_usd_per_token"`
	CompletionUSD float64 `json:"completion_usd_per_token"`
	ImageUSD      float64 `json:"image_usd"`
	RequestUSD    float64 `json:"request_usd"`
}

var imageModels struct {
	mu     sync.Mutex
	at     time.Time
	models []ImageModel
}

// ImageModels returns the models that output images, cheapest completion first (cached 1 h).
func (c *Client) ImageModels(ctx context.Context) ([]ImageModel, error) {
	imageModels.mu.Lock()
	defer imageModels.mu.Unlock()
	if time.Since(imageModels.at) < time.Hour && len(imageModels.models) > 0 {
		return imageModels.models, nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.BaseURL+"/models?output_modalities=image", nil)
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
			ID           string `json:"id"`
			Name         string `json:"name"`
			Architecture struct {
				InputModalities  []string `json:"input_modalities"`
				OutputModalities []string `json:"output_modalities"`
			} `json:"architecture"`
			Pricing map[string]string `json:"pricing"`
		} `json:"data"`
	}
	if err := decodeImageResponse(resp, &raw); err != nil {
		return nil, err
	}
	price := func(p map[string]string, k string) float64 {
		v, _ := strconv.ParseFloat(p[k], 64)
		return v
	}
	out := []ImageModel{}
	for _, d := range raw.Data {
		// The filter param may be ignored by an older API or a mock; check ourselves.
		if !containsStr(d.Architecture.OutputModalities, "image") {
			continue
		}
		out = append(out, ImageModel{
			ID: d.ID, Name: d.Name,
			TextOutput:    containsStr(d.Architecture.OutputModalities, "text"),
			ImageInput:    containsStr(d.Architecture.InputModalities, "image"),
			PromptUSD:     price(d.Pricing, "prompt"),
			CompletionUSD: price(d.Pricing, "completion"),
			ImageUSD:      price(d.Pricing, "image"),
			RequestUSD:    price(d.Pricing, "request"),
		})
	}
	if len(out) == 0 {
		return nil, errors.New("openrouter: no image models returned")
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].CompletionUSD < out[j].CompletionUSD })
	imageModels.models, imageModels.at = out, time.Now()
	return out, nil
}

// FindImageModel returns an image model by id.
func (c *Client) FindImageModel(ctx context.Context, id string) (ImageModel, error) {
	ms, err := c.ImageModels(ctx)
	if err != nil {
		return ImageModel{}, err
	}
	for _, m := range ms {
		if m.ID == id {
			return m, nil
		}
	}
	return ImageModel{}, fmt.Errorf("image model %q not found on OpenRouter", id)
}
