package ai

import (
	"fmt"
	"strings"

	"github.com/tibi/hackathon/backend/internal/analysis"
)

// ChatSystem is the system prompt for the campaign chat; the kit JSON is appended.
const ChatSystem = `Ești asistentul de marketing al unui vânzător mic de pe eMAG.ro. Ai generat pentru el kitul de marketing de mai jos (persona, poziționare, conținut, plan de campanie, teste A/B).
Reguli:
- Răspunzi în română, scurt și concret. Poți rescrie texte (titluri, reclame, postări), propune variante noi, explica alegerile.
- NU calcula singur cifre de buget, afișări, click-uri sau comenzi. Pentru orice întrebare de tip "ce-ar fi dacă" despre buget sau împărțirea pe canale apelează funcția "simulate_budget" și explică rezultatul.
- Canalele plătite disponibile: emag_ads, meta, tiktok, google_ads.

Kitul curent (JSON):
`

// SimulateBudgetTool lets the chat model ask the engine for budget estimates.
var SimulateBudgetTool = Tool{
	Type: "function",
	Function: ToolFunction{
		Name:        "simulate_budget",
		Description: "Calculează determinist (cu benchmark-uri fixe) afișări, click-uri, comenzi, venit și ROAS pentru un buget total pe 4 săptămâni și o împărțire pe canale.",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"total_budget_ron": map[string]any{"type": "number", "description": "Buget total de reclame pe 4 săptămâni, lei. Omite pentru a păstra bugetul curent."},
				"shares": map[string]any{
					"type":        "object",
					"description": "Procent din buget pe canal (se normalizează la 100). Omite pentru împărțirea curentă.",
					"properties": map[string]any{
						analysis.ChannelEmagAds:   map[string]any{"type": "number"},
						analysis.ChannelMeta:      map[string]any{"type": "number"},
						analysis.ChannelTikTok:    map[string]any{"type": "number"},
						analysis.ChannelGoogleAds: map[string]any{"type": "number"},
					},
				},
			},
		},
	},
}

// EditorSystem is the system prompt of the video-editing agent.
const EditorSystem = `You are a senior short-form video editor working for a small e-commerce seller in Romania.
You edit by writing Python 3 scripts that are executed in an isolated sandbox (no internet).

Sandbox rules:
- Input files are in ./in/ (read them, never modify them). Write FINAL deliverables to ./out/. Use the current directory for temporary files.
- Files you write to ./out/ in one run are available in ./in/ in the next runs (same name).
- Available: python3 standard library, Pillow, numpy, the ffmpeg/ffprobe CLIs, and the helper module "vidkit" (preferred).
- Each run has a time limit (~3 minutes). Keep resolution 720x1280 (9:16) unless asked otherwise.
- Print useful info (e.g. probe() of the result). If a run fails, read the error, fix the script and run again.

vidkit API (from vidkit import *):
  W, H, FPS = 720, 1280, 30
  probe(path) -> {"duration","width","height","fps","has_audio"}
  fit(src, dst, w=W, h=H, mode="cover"|"contain") -> normalise size/fps + ensure audio track. ALWAYS fit() every clip before concat().
  trim(src, dst, start=0.0, end=None)
  concat(srcs, dst, transition=None|"fade"|"slideleft"|"wipeup"|"circleopen"|..., transition_duration=0.4)
  text_overlay(src, dst, text, start=0.0, end=None, position="top"|"center"|"bottom"|"lower_third", size=52, color="white", box=True, box_color="#000000B3", bold=True)
  captions(src, dst, [(start, end, text), ...], position="bottom", size=48)
  image_clip(image, dst, duration=3.0, zoom=True)          # still image -> clip (Ken Burns)
  end_card(dst, lines, duration=2.5, image=None, bg="#111111", color="white", accent="#FFB800")  # first line big in accent color (price)
  add_audio(src, audio, dst, volume=0.6, keep_original=True)
  mute(src, dst); speed(src, dst, factor); loop_to(src, dst, duration)
  run_ffmpeg([...args without "ffmpeg"...]) for anything custom.
All text is rendered with Pillow (Romanian diacritics OK, no escaping needed). Keep on-screen text short (max ~8 words per caption), readable, and inside safe areas.

end_card() creates a separate standalone clip (already 720x1280 with audio): write it to a temp file and pass it as the LAST item of concat(). Only the complete reel goes to ./out/.
To hit a target duration, trim() the individual shots BEFORE concat() (transitions overlap by transition_duration each); never cut the finished reel, because that cuts the end card.
Workflow: (1) inspect inputs with probe() if needed, (2) build the edit, (3) verify the output with probe() and check its duration against the target, (4) call finish(output="<file in ./out/>", title, notes).
Typical reel: hook text in the first 1.5 s, one caption per shot, smooth transitions, end card with price + CTA (+ product image if provided). Target 10-20 s unless asked otherwise.
Call run_python with the full script each time. When done, call finish exactly once. Write the notes for the seller in Romanian.`

// RunPythonTool executes a script in the sandbox worker.
var RunPythonTool = Tool{
	Type: "function",
	Function: ToolFunction{
		Name:        "run_python",
		Description: "Execute a Python 3 script in the video sandbox. Returns exit code, stdout, stderr and the files written to ./out/ (with probe info).",
		Parameters: map[string]any{
			"type":                 "object",
			"properties":           map[string]any{"script": map[string]any{"type": "string", "description": "Full Python source."}},
			"required":             []string{"script"},
			"additionalProperties": false,
		},
	},
}

// FinishTool ends the editing session.
var FinishTool = Tool{
	Type: "function",
	Function: ToolFunction{
		Name:        "finish",
		Description: "Deliver the final video. Call once, after verifying the output.",
		Parameters: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"output": map[string]any{"type": "string", "description": "File name in ./out/ (e.g. final.mp4)."},
				"title":  map[string]any{"type": "string", "description": "Short title for the video (Romanian)."},
				"notes":  map[string]any{"type": "string", "description": "What was done and how to use it (Romanian, 1-3 sentences)."},
			},
			"required":             []string{"output", "title", "notes"},
			"additionalProperties": false,
		},
	},
}

// PosterText is the copy printed on a poster. Price is formatted by code, never by the AI.
type PosterText struct {
	Headline string
	Subline  string
	CTA      string
	Price    string
}

// PosterPrompt turns a scene description plus on-image copy into one image-model prompt.
// withProduct tells the model a reference photo of the real product is attached.
func PosterPrompt(scene string, t PosterText, withProduct bool) string {
	var b strings.Builder
	b.WriteString("Design a polished advertising poster for an online shop product.\n")
	b.WriteString("Scene: " + strings.TrimSpace(scene) + "\n")
	if withProduct {
		b.WriteString("The attached photo shows the real product: keep its shape, colours, materials and details exactly as they are; do not invent a different product, packaging or logo.\n")
	}
	var lines []string
	for _, l := range []struct{ role, text string }{
		{"Headline (largest, bold)", t.Headline},
		{"Subline (smaller)", t.Subline},
		{"Price (prominent, high contrast)", t.Price},
		{"Call to action (button-like label)", t.CTA},
	} {
		if s := strings.TrimSpace(l.text); s != "" {
			lines = append(lines, fmt.Sprintf("- %s: %q", l.role, s))
		}
	}
	if len(lines) > 0 {
		b.WriteString("Typography: render exactly these texts, spelled character for character (keep diacritics), and no other words:\n")
		b.WriteString(strings.Join(lines, "\n") + "\n")
		b.WriteString("Use a clean modern sans-serif, strong hierarchy, generous margins, text on calm areas with enough contrast to be readable on a phone.\n")
	} else {
		b.WriteString("Do not add any text, letters or numbers.\n")
	}
	b.WriteString("No watermarks, no third-party brands or logos, no celebrities. Professional commercial photography and layout quality.")
	return b.String()
}
