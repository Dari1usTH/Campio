package ai

import (
	"encoding/base64"
	"strings"
	"testing"
)

func TestPosterPrompt(t *testing.T) {
	p := PosterPrompt("candle on oak table", PosterText{Headline: "Seară liniștită", Price: "89 lei", CTA: "Comandă"}, true)
	for _, want := range []string{"candle on oak table", `"Seară liniștită"`, `"89 lei"`, `"Comandă"`, "attached photo"} {
		if !strings.Contains(p, want) {
			t.Errorf("prompt missing %q:\n%s", want, p)
		}
	}
	if strings.Contains(p, "Subline") {
		t.Errorf("empty subline should be omitted:\n%s", p)
	}
	bare := PosterPrompt("x", PosterText{}, false)
	if !strings.Contains(bare, "Do not add any text") || strings.Contains(bare, "attached photo") {
		t.Errorf("unexpected text-free prompt:\n%s", bare)
	}
}

func TestDecodeDataURL(t *testing.T) {
	img, err := decodeDataURL("data:image/png;base64," + base64.StdEncoding.EncodeToString([]byte("abc")))
	if err != nil || img.Mime != "image/png" || string(img.Data) != "abc" {
		t.Fatalf("got %+v, %v", img, err)
	}
	for _, bad := range []string{"https://x/y.png", "data:image/png,abc", "data:image/png;base64,@@"} {
		if _, err := decodeDataURL(bad); err == nil {
			t.Errorf("%q: expected error", bad)
		}
	}
}
