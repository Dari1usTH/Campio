package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/tibi/hackathon/backend/internal/analysis"
	"github.com/tibi/hackathon/backend/internal/campaign"
)

// createCampaign accepts either multipart/form-data (prompt + images[]) or
// JSON {"prompt": "..."}.
func (s *Server) createCampaign(c *gin.Context) {
	var prompt string
	var images []campaign.ImageFile
	if strings.HasPrefix(c.ContentType(), "multipart/") {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, int64(campaign.MaxImages*campaign.MaxImageBytes+(1<<20)))
		form, err := c.MultipartForm()
		if err != nil {
			fail(c, http.StatusBadRequest, "invalid_request", fmt.Sprintf("invalid multipart body (max %d images of %d MB): %v", campaign.MaxImages, campaign.MaxImageBytes>>20, err))
			return
		}
		prompt = strings.Join(form.Value["prompt"], "\n")
		files := append(form.File["images"], form.File["image"]...)
		if len(files) > campaign.MaxImages {
			fail(c, http.StatusBadRequest, "invalid_request", fmt.Sprintf("at most %d images", campaign.MaxImages))
			return
		}
		for _, fh := range files {
			f, err := fh.Open()
			if err != nil {
				failErr(c, err)
				return
			}
			defer f.Close()
			mime, err := sniffMime(fh.Header.Get("Content-Type"), f)
			if err != nil {
				failErr(c, err)
				return
			}
			images = append(images, campaign.ImageFile{Name: fh.Filename, Mime: mime, R: f})
		}
	} else {
		var req struct {
			Prompt string `json:"prompt"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			fail(c, http.StatusBadRequest, "invalid_request", "invalid JSON body: "+err.Error())
			return
		}
		prompt = req.Prompt
	}
	k, err := s.Campaigns.Create(c.Request.Context(), prompt, images)
	if err != nil {
		failErr(c, err)
		return
	}
	c.Header("Location", "/api/campaigns/"+k.ID.String())
	c.JSON(http.StatusAccepted, k)
}

func (s *Server) answerQuestions(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	var req campaign.AnswerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "invalid_request", "invalid JSON body: "+err.Error())
		return
	}
	k, err := s.Campaigns.Answer(c.Request.Context(), id, req)
	if err != nil {
		failErr(c, err)
		return
	}
	c.JSON(http.StatusAccepted, k)
}

// sniffMime trusts the declared type unless it is missing or generic.
func sniffMime(declared string, f io.ReadSeeker) (string, error) {
	if declared != "" && declared != "application/octet-stream" {
		return declared, nil
	}
	buf := make([]byte, 512)
	n, _ := f.Read(buf)
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		return "", err
	}
	return http.DetectContentType(buf[:n]), nil
}

func (s *Server) listCampaigns(c *gin.Context) {
	limit := atoiDefault(c.Query("limit"), 20, 1, 100)
	offset := atoiDefault(c.Query("offset"), 0, 0, 1_000_000)
	items, total, err := s.Store.ListCampaigns(c.Request.Context(), limit, offset)
	if err != nil {
		failErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": nonNil(items), "total": total, "limit": limit, "offset": offset})
}

func (s *Server) getCampaign(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	k, _, err := s.Campaigns.Get(c.Request.Context(), id)
	if err != nil {
		failErr(c, err)
		return
	}
	c.JSON(http.StatusOK, k)
}

func (s *Server) deleteCampaign(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	if err := s.Store.DeleteCampaign(c.Request.Context(), id); err != nil {
		failErr(c, err)
		return
	}
	_ = s.Media.RemoveCampaign(id.String())
	c.Status(http.StatusNoContent)
}

type budgetSimReq struct {
	TotalBudgetRON *float64           `json:"total_budget_ron"`
	Shares         map[string]float64 `json:"shares"`
}

func (s *Server) simulateBudget(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	var req budgetSimReq
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "invalid_request", "invalid JSON body: "+err.Error())
		return
	}
	k, _, err := s.Campaigns.Get(c.Request.Context(), id)
	if err != nil {
		failErr(c, err)
		return
	}
	total := k.Input.AdBudgetRON
	if req.TotalBudgetRON != nil {
		if *req.TotalBudgetRON < 0 {
			fail(c, http.StatusBadRequest, "invalid_request", "total_budget_ron must be >= 0")
			return
		}
		total = *req.TotalBudgetRON
	}
	shares := req.Shares
	if len(shares) == 0 && k.Plan != nil {
		shares = map[string]float64{}
		for _, ch := range k.Plan.Channels {
			shares[ch.Channel] = ch.SharePct
		}
	}
	for ch := range shares {
		if _, ok := analysis.Benchmarks[ch]; !ok {
			fail(c, http.StatusBadRequest, "invalid_request", "unknown channel "+ch+" (use emag_ads, meta, tiktok, google_ads)")
			return
		}
	}
	plans, totals := analysis.AllocateBudget(total, k.Input.SalePrice, shares)
	c.JSON(http.StatusOK, campaign.BudgetSimulation{TotalBudgetRON: total, Shares: shares, Channels: plans, Totals: totals})
}

func (s *Server) listMessages(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	if _, err := s.Store.GetCampaign(c.Request.Context(), id); err != nil {
		failErr(c, err)
		return
	}
	msgs, err := s.Store.ListMessages(c.Request.Context(), id)
	if err != nil {
		failErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": nonNil(msgs)})
}

func (s *Server) postMessage(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	var req struct {
		Message string `json:"message"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Message) == "" {
		fail(c, http.StatusBadRequest, "invalid_request", "message is required")
		return
	}
	if len(req.Message) > 4000 {
		fail(c, http.StatusBadRequest, "invalid_request", "message too long (max 4000 chars)")
		return
	}
	k, _, err := s.Campaigns.Get(c.Request.Context(), id)
	if err != nil {
		failErr(c, err)
		return
	}
	if k.Status != campaign.StatusCompleted {
		failErr(c, campaign.ErrNotReady)
		return
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), 120*time.Second)
	defer cancel()
	text := strings.TrimSpace(req.Message)

	if !strings.Contains(c.GetHeader("Accept"), "text/event-stream") {
		reply, err := s.Campaigns.Chat(ctx, id, text, nil, nil)
		if err != nil {
			failErr(c, err)
			return
		}
		c.JSON(http.StatusOK, reply)
		return
	}
	if !s.AI.Enabled() {
		fail(c, http.StatusServiceUnavailable, "ai_unavailable", "OPENROUTER_API_KEY is not set")
		return
	}
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")
	c.Status(http.StatusOK)
	send := func(event string, v any) {
		b, _ := json.Marshal(v)
		_, _ = c.Writer.WriteString("event: " + event + "\ndata: " + string(b) + "\n\n")
		c.Writer.Flush()
	}
	reply, err := s.Campaigns.Chat(ctx, id, text,
		func(t string) { send("token", gin.H{"text": t}) },
		func(sim campaign.BudgetSimulation) { send("simulation", sim) },
	)
	if err != nil {
		send("error", apiError{Code: "ai_error", Message: err.Error()})
		return
	}
	send("done", reply)
}

// ---- media ----

func (s *Server) listAssets(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	if _, err := s.Store.GetCampaign(c.Request.Context(), id); err != nil {
		failErr(c, err)
		return
	}
	items, err := s.Store.ListAssets(c.Request.Context(), id)
	if err != nil {
		failErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": nonNil(items)})
}

func (s *Server) upload(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 101<<20)
	fh, err := c.FormFile("file")
	if err != nil {
		fail(c, http.StatusBadRequest, "invalid_request", "multipart field 'file' is required (max 100 MB)")
		return
	}
	f, err := fh.Open()
	if err != nil {
		failErr(c, err)
		return
	}
	defer f.Close()
	mime, err := sniffMime(fh.Header.Get("Content-Type"), f)
	if err != nil {
		failErr(c, err)
		return
	}
	a, err := s.Campaigns.SaveUpload(c.Request.Context(), id, c.PostForm("role"), fh.Filename, mime, f)
	if err != nil {
		failErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, a)
}

func (s *Server) generateVideos(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	var req campaign.VideoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "invalid_request", "invalid JSON body: "+err.Error())
		return
	}
	assets, est, err := s.Campaigns.GenerateVideos(c.Request.Context(), id, req)
	if err != nil {
		failErr(c, err)
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"items": nonNil(assets), "estimated_cost_usd": est})
}

func (s *Server) getAsset(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	a, err := s.Store.GetAsset(c.Request.Context(), id)
	if err != nil {
		failErr(c, err)
		return
	}
	c.JSON(http.StatusOK, a)
}

func (s *Server) assetContent(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	a, err := s.Store.GetAsset(c.Request.Context(), id)
	if err != nil {
		failErr(c, err)
		return
	}
	if a.Status != campaign.StatusCompleted || a.FilePath == "" {
		fail(c, http.StatusConflict, "not_ready", "asset is "+a.Status)
		return
	}
	f, err := os.Open(s.Media.Path(a.FilePath))
	if err != nil {
		fail(c, http.StatusNotFound, "not_found", "file missing")
		return
	}
	defer f.Close()
	st, _ := f.Stat()
	c.Header("Content-Type", a.Mime)
	c.Header("Cache-Control", "private, max-age=3600")
	if c.Query("download") == "1" {
		c.Header("Content-Disposition", `attachment; filename="`+strings.ReplaceAll(a.Name, `"`, "")+`"`)
	}
	http.ServeContent(c.Writer, c.Request, a.Name, st.ModTime(), f) // supports Range for <video>
}

func (s *Server) startEdit(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	var req campaign.EditRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "invalid_request", "invalid JSON body: "+err.Error())
		return
	}
	if len(req.Instructions) > 4000 {
		fail(c, http.StatusBadRequest, "invalid_request", "instructions too long (max 4000 chars)")
		return
	}
	e, err := s.Campaigns.StartEdit(c.Request.Context(), id, req)
	if err != nil {
		failErr(c, err)
		return
	}
	c.JSON(http.StatusAccepted, e)
}

func (s *Server) listEdits(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	if _, err := s.Store.GetCampaign(c.Request.Context(), id); err != nil {
		failErr(c, err)
		return
	}
	items, err := s.Store.ListEdits(c.Request.Context(), id)
	if err != nil {
		failErr(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"items": nonNil(items)})
}

func (s *Server) getEdit(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	e, err := s.Store.GetEdit(c.Request.Context(), id)
	if err != nil {
		failErr(c, err)
		return
	}
	c.JSON(http.StatusOK, e)
}
