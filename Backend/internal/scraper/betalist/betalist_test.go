package betalist

import (
	"os"
	"strings"
	"testing"
)

// testdata/search.html is trimmed from the live page for "laptop" (2026-11-07).
func TestParse(t *testing.T) {
	f, err := os.Open("testdata/search.html")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	ls, err := Parse(f, "https://betalist.com")
	if err != nil {
		t.Fatal(err)
	}
	if len(ls) != 3 {
		t.Fatalf("want 3 launches, got %d: %+v", len(ls), ls)
	}
	s := ls[2]
	if s.ID != "slidenjoy" || s.Name != "Slidenjoy" || s.URL != "https://betalist.com/startups/slidenjoy" ||
		s.Tagline != "World's first accessory tripling your laptop screen with a single USB" || !strings.HasPrefix(s.ImageURL, "https://") {
		t.Fatalf("wrong launch: %+v", s)
	}
}
