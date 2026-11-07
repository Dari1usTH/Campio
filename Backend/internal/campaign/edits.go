package campaign

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/tibi/hackathon/backend/internal/ai"
	"github.com/tibi/hackathon/backend/internal/analysis"
	"github.com/tibi/hackathon/backend/internal/db"
	"github.com/tibi/hackathon/backend/internal/media"
	"github.com/tibi/hackathon/backend/internal/sandbox"
)

const (
	editMaxSteps = 12
	// finish is refused when the output is far from target_duration_s.
	editDurationMinRatio   = 0.6
	editDurationMaxRatio   = 1.5
	editMaxDurationRejects = 2
	editRunTimeoutS        = 180
	editSessionTimeout     = 15 * time.Minute
	maxUploadBytes         = 100 << 20
	logTail                = 3000
)

// EditRequest starts an AI editing session.
type EditRequest struct {
	Instructions    string      `json:"instructions"`
	AssetIDs        []uuid.UUID `json:"asset_ids"`
	ConceptID       string      `json:"concept_id"`
	TargetDurationS int         `json:"target_duration_s"`
}

// StartEdit validates the inputs, stores the session and runs it in the background.
func (s *Service) StartEdit(ctx context.Context, campaignID uuid.UUID, req EditRequest) (db.Edit, error) {
	if !s.AI.Enabled() {
		return db.Edit{}, ai.ErrNotConfigured
	}
	k, _, err := s.Get(ctx, campaignID)
	if err != nil {
		return db.Edit{}, err
	}
	all, err := s.Store.ListAssets(ctx, campaignID)
	if err != nil {
		return db.Edit{}, err
	}
	byID := map[uuid.UUID]db.Asset{}
	for _, a := range all {
		byID[a.ID] = a
	}
	var inputs []db.Asset
	if len(req.AssetIDs) > 0 {
		for _, id := range req.AssetIDs {
			a, ok := byID[id]
			if !ok {
				return db.Edit{}, invalid("asset %s does not belong to this campaign", id)
			}
			if a.Status != StatusCompleted {
				return db.Edit{}, invalid("asset %s is not ready (status %s)", id, a.Status)
			}
			inputs = append(inputs, a)
		}
	} else {
		// default: the concept's clips (or all clips) + all uploads
		for _, a := range all {
			if a.Status != StatusCompleted {
				continue
			}
			if a.Kind == KindUpload {
				inputs = append(inputs, a)
				continue
			}
			if a.Kind == KindGenerated {
				var m VideoMeta
				_ = json.Unmarshal(a.Meta, &m)
				if req.ConceptID == "" || m.ConceptID == req.ConceptID {
					inputs = append(inputs, a)
				}
			}
		}
	}
	hasVideo := false
	for _, a := range inputs {
		hasVideo = hasVideo || strings.HasPrefix(a.Mime, "video/") || strings.HasPrefix(a.Mime, "image/")
	}
	if !hasVideo {
		return db.Edit{}, invalid("no completed clips or images to edit; generate clips or upload media first")
	}

	instr := strings.TrimSpace(req.Instructions)
	if instr == "" {
		instr = "Montează un reel vertical 9:16 de 15-25 secunde: hook în prima secundă, clipurile în ordinea shot-urilor, câte un caption scurt pe clipurile care nu au deja text (caption_burned), tranziții fine și end card cu prețul, numele produsului și CTA (cu imaginea produsului dacă există)."
	}
	if req.TargetDurationS > 0 {
		instr += fmt.Sprintf("\nDurată țintă: %d secunde.", req.TargetDurationS)
	}
	e := db.Edit{ID: uuid.New(), CampaignID: campaignID, Status: StatusRunning, Instructions: instr, Steps: []db.EditStep{}}
	for _, a := range inputs {
		e.InputAssetIDs = append(e.InputAssetIDs, a.ID)
	}
	if err := s.Store.InsertEdit(ctx, e); err != nil {
		return db.Edit{}, err
	}
	e.CreatedAt, e.UpdatedAt = time.Now().UTC(), time.Now().UTC()
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.runEdit(e, k, inputs, req.ConceptID, req.TargetDurationS)
	}()
	return e, nil
}

type editSession struct {
	mu     sync.Mutex
	e      db.Edit
	dir    string
	files  map[string]string         // sandbox name → local path
	probes map[string]*sandbox.Probe // probe info of produced files
	store  *db.Store
}

func (es *editSession) log(typ, content string, data any) {
	es.mu.Lock()
	es.e.Steps = append(es.e.Steps, db.EditStep{At: time.Now().UTC(), Type: typ, Content: content, Data: data})
	e := es.e
	es.mu.Unlock()
	if err := es.store.SaveEdit(context.Background(), e); err != nil {
		slog.Warn("save edit", "id", e.ID, "err", err)
	}
}

func (s *Service) runEdit(e db.Edit, k Kit, inputs []db.Asset, conceptID string, targetS int) {
	ctx, cancel := context.WithTimeout(context.Background(), editSessionTimeout)
	defer cancel()
	es := &editSession{e: e, files: map[string]string{}, probes: map[string]*sandbox.Probe{}, store: s.Store,
		dir: s.Media.Path(filepath.Join(e.CampaignID.String(), "edits", e.ID.String()))}
	defer os.RemoveAll(es.dir)
	if err := os.MkdirAll(es.dir, 0o755); err != nil {
		s.finishEdit(es, err)
		return
	}

	// name inputs predictably for the model
	var table []map[string]any
	counters := map[string]int{}
	for _, a := range inputs {
		name := sandboxName(a, counters)
		es.files[name] = s.Media.Path(a.FilePath)
		row := map[string]any{"file": "in/" + name, "kind": a.Kind, "mime": a.Mime}
		if a.Role != "" {
			row["role"] = a.Role
		}
		if a.DurationS > 0 {
			row["duration_s"] = a.DurationS
		}
		var m VideoMeta
		if json.Unmarshal(a.Meta, &m) == nil {
			if m.Caption != "" {
				row["caption"] = m.Caption
			}
			if m.CaptionBurned {
				row["caption_burned"] = true
			}
			if m.ShotIndex != nil {
				row["concept_id"], row["shot"] = m.ConceptID, *m.ShotIndex+1
			}
		}
		table = append(table, row)
	}

	ctxInfo := map[string]any{
		"product_name": k.Input.ProductName, "brand": k.Input.BrandName, "price_ron": k.Input.SalePrice,
	}
	if k.Strategy != nil {
		ctxInfo["main_message"] = k.Strategy.Positioning.MainMessage
		ctxInfo["tone"] = k.Strategy.Positioning.Tone
	}
	if k.Content != nil {
		for _, v := range k.Content.VideoConcepts {
			if v.ID == conceptID || (conceptID == "" && len(k.Content.VideoConcepts) > 0 && v.ID == k.Content.VideoConcepts[0].ID) {
				ctxInfo["video_concept"] = v
			}
		}
	}
	user := fmt.Sprintf("Instructions from the seller (Romanian):\n%s\n\nCampaign context (JSON):\n%s\n\nInput files (JSON):\n%s",
		e.Instructions, toJSON(ctxInfo), toJSON(table))
	es.log("message", "Sesiune de editare pornită cu "+fmt.Sprint(len(inputs))+" fișiere.", table)

	var finished *db.Asset
	durationRejects := 0
	handler := func(ctx context.Context, name string, args json.RawMessage) (string, any, bool, error) {
		switch name {
		case "run_python":
			var a struct {
				Script string `json:"script"`
			}
			if err := json.Unmarshal(args, &a); err != nil || strings.TrimSpace(a.Script) == "" {
				return "", nil, false, fmt.Errorf("script is required")
			}
			es.log("script", a.Script, nil)
			res, err := s.Sandbox.Run(ctx, a.Script, es.snapshotFiles(), editRunTimeoutS)
			if err != nil {
				es.log("error", err.Error(), nil)
				return "", nil, false, err
			}
			outs := []map[string]any{}
			for _, o := range res.Outputs {
				p := filepath.Join(es.dir, o.Name)
				if err := os.WriteFile(p, o.Data, 0o644); err != nil {
					return "", nil, false, err
				}
				es.mu.Lock()
				es.files[o.Name] = p
				es.probes[o.Name] = o.Probe
				es.mu.Unlock()
				outs = append(outs, map[string]any{"name": o.Name, "size": o.Size, "probe": o.Probe})
			}
			summary := map[string]any{
				"exit_code": res.ExitCode, "timed_out": res.TimedOut, "duration_ms": res.DurationMS,
				"stdout": tail(res.Stdout, logTail), "stderr": tail(res.Stderr, logTail), "outputs": outs,
				"available_in_next_run": es.names(),
			}
			es.log("result", fmt.Sprintf("exit %d în %.1fs, %d fișiere", res.ExitCode, float64(res.DurationMS)/1000, len(outs)), summary)
			return toJSON(summary), nil, false, nil
		case "finish":
			var a struct{ Output, Title, Notes string }
			if err := json.Unmarshal(args, &a); err != nil {
				return "", nil, false, err
			}
			name := filepath.Base(strings.TrimPrefix(strings.TrimPrefix(a.Output, "./"), "out/"))
			es.mu.Lock()
			p, ok := es.files[name]
			es.mu.Unlock()
			if !ok || !strings.HasPrefix(p, es.dir) {
				return "", nil, false, fmt.Errorf("output %q was not produced in ./out/; available: %v", a.Output, es.names())
			}
			// Deterministic check: models sometimes deliver an intermediate file (e.g. only the end card).
			// Refuse at most editMaxDurationRejects times so an impossible target cannot loop forever.
			es.mu.Lock()
			pr := es.probes[name]
			es.mu.Unlock()
			if targetS > 0 && pr != nil && durationRejects < editMaxDurationRejects {
				lo, hi := editDurationMinRatio*float64(targetS), editDurationMaxRatio*float64(targetS)
				if pr.Duration < lo || pr.Duration > hi {
					durationRejects++
					es.log("error", fmt.Sprintf("Rezultat respins: %.1fs, ținta e %ds.", pr.Duration, targetS), nil)
					return "", nil, false, fmt.Errorf("%s is %.1f s long but the target is %d s (accepted range %.0f-%.0f s). "+
						"Make sure ./out/ contains the complete reel (all shots concatenated, end card appended last), then call finish again",
						name, pr.Duration, targetS, lo, hi)
				}
			}
			asset, err := s.storeEditOutput(ctx, es, p, name, a.Title, a.Notes)
			if err != nil {
				return "", nil, false, err
			}
			finished = &asset
			es.mu.Lock()
			es.e.Title, es.e.Notes, es.e.OutputAssetID = a.Title, a.Notes, &asset.ID
			es.mu.Unlock()
			es.log("finish", a.Notes, map[string]any{"asset_id": asset.ID, "title": a.Title})
			return `{"ok":true}`, nil, true, nil
		}
		return "", nil, false, fmt.Errorf("unknown tool %q", name)
	}

	res, err := s.AI.RunAgent(ctx,
		[]ai.Message{{Role: "system", Content: ai.EditorSystem}, {Role: "user", Content: user}},
		ai.AgentOptions{Model: s.Cfg.EditorModel, Tools: []ai.Tool{ai.RunPythonTool, ai.FinishTool}, MaxSteps: editMaxSteps, MaxTokens: 6000, Temperature: 0.2, RequireTool: true},
		handler)
	es.mu.Lock()
	es.e.CostUSD = analysis.Round6(res.Usage.Cost)
	es.mu.Unlock()
	if strings.TrimSpace(res.Content) != "" {
		es.log("message", res.Content, nil)
	}
	if err == nil && finished == nil {
		err = fmt.Errorf("the editor stopped without delivering a video")
	}
	s.finishEdit(es, err)
}

func (s *Service) finishEdit(es *editSession, err error) {
	es.mu.Lock()
	if err != nil {
		es.e.Status, es.e.Error = StatusFailed, err.Error()
	} else {
		es.e.Status = StatusCompleted
	}
	e := es.e
	es.mu.Unlock()
	if err := s.Store.SaveEdit(context.Background(), e); err != nil {
		slog.Error("save edit", "id", e.ID, "err", err)
	}
}

func (s *Service) storeEditOutput(ctx context.Context, es *editSession, path, name, title, notes string) (db.Asset, error) {
	a := db.Asset{ID: uuid.New(), CampaignID: es.e.CampaignID, Kind: KindEdited, Status: StatusCompleted, Name: name, Mime: media.MimeOf(name)}
	src, err := os.Open(path)
	if err != nil {
		return a, err
	}
	defer src.Close()
	a.FilePath = media.Rel(es.e.CampaignID.String(), a.ID.String()+filepath.Ext(name))
	n, err := s.Media.Save(a.FilePath, src, 500<<20)
	if err != nil {
		return a, err
	}
	a.SizeBytes = n
	es.mu.Lock()
	if pr := es.probes[name]; pr != nil {
		a.DurationS, a.Width, a.Height = pr.Duration, pr.Width, pr.Height
	}
	es.mu.Unlock()
	a.Meta, _ = json.Marshal(VideoMeta{Title: title, Notes: notes, EditID: es.e.ID.String()})
	return a, s.Store.InsertAsset(ctx, a)
}

func (es *editSession) snapshotFiles() map[string]string {
	es.mu.Lock()
	defer es.mu.Unlock()
	cp := make(map[string]string, len(es.files))
	for k, v := range es.files {
		cp[k] = v
	}
	return cp
}

func (es *editSession) names() []string {
	es.mu.Lock()
	defer es.mu.Unlock()
	out := make([]string, 0, len(es.files))
	for k := range es.files {
		out = append(out, "in/"+k)
	}
	sort.Strings(out)
	return out
}

func sandboxName(a db.Asset, counters map[string]int) string {
	ext := strings.ToLower(filepath.Ext(a.Name))
	if ext == "" {
		ext = filepath.Ext(a.FilePath)
	}
	base := a.Kind
	switch a.Kind {
	case KindGenerated:
		var m VideoMeta
		_ = json.Unmarshal(a.Meta, &m)
		if m.ConceptID != "" && m.ShotIndex != nil {
			return fmt.Sprintf("clip_%s_shot%d%s", m.ConceptID, *m.ShotIndex+1, ext)
		}
		base = "clip"
	case KindUpload:
		base = firstNonEmpty(a.Role, "upload")
	case KindEdited:
		base = "edit"
	}
	counters[base]++
	return fmt.Sprintf("%s_%d%s", base, counters[base], ext)
}

// SaveUpload stores a user-provided file (product photo, logo, music, footage).
func (s *Service) SaveUpload(ctx context.Context, campaignID uuid.UUID, role, filename, mime string, r io.Reader) (db.Asset, error) {
	if _, err := s.Store.GetCampaign(ctx, campaignID); err != nil {
		return db.Asset{}, err
	}
	switch role {
	case RoleProductImage, RoleLogo:
		if !strings.HasPrefix(mime, "image/") {
			return db.Asset{}, invalid("%s must be an image", role)
		}
	case RoleMusic:
		if !strings.HasPrefix(mime, "audio/") {
			return db.Asset{}, invalid("music must be an audio file")
		}
	case RoleFootage:
		if !strings.HasPrefix(mime, "video/") && !strings.HasPrefix(mime, "image/") {
			return db.Asset{}, invalid("footage must be a video or image")
		}
	default:
		return db.Asset{}, invalid("role must be one of product_image, logo, music, footage")
	}
	ext := strings.ToLower(filepath.Ext(filename))
	if ext == "" || len(ext) > 6 {
		return db.Asset{}, invalid("file name must have an extension")
	}
	a := db.Asset{ID: uuid.New(), CampaignID: campaignID, Kind: KindUpload, Role: role, Status: StatusCompleted,
		Name: filepath.Base(filename), Mime: mime}
	a.FilePath = media.Rel(campaignID.String(), a.ID.String()+ext)
	n, err := s.Media.Save(a.FilePath, r, maxUploadBytes)
	if err != nil {
		return db.Asset{}, invalid("%v", err)
	}
	a.SizeBytes = n
	a.Meta = json.RawMessage("{}")
	return a, s.Store.InsertAsset(ctx, a)
}

func tail(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return "…" + s[len(s)-n:]
}

func toJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
