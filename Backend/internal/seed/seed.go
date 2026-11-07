// Package seed loads precollected market and trend data so the demo works
// even when eMAG or Google Trends are unreachable.
package seed

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/tibi/hackathon/backend/internal/model"
)

// File is the on-disk format of a seed file (seed/*.json).
type File struct {
	Keyword string               `json:"keyword"`
	Market  model.MarketSnapshot `json:"market"`
	Trends  model.TrendSeries    `json:"trends"`
}

// LoadDir reads every *.json seed file in dir.
func LoadDir(dir string) ([]File, error) {
	paths, err := filepath.Glob(filepath.Join(dir, "*.json"))
	if err != nil {
		return nil, err
	}
	var out []File
	for _, p := range paths {
		b, err := os.ReadFile(p)
		if err != nil {
			return nil, err
		}
		var f File
		if err := json.Unmarshal(b, &f); err != nil {
			return nil, fmt.Errorf("seed %s: %w", p, err)
		}
		f.Keyword = NormalizeKeyword(f.Keyword)
		f.Market.Keyword, f.Trends.Keyword = f.Keyword, f.Keyword
		f.Market.Source, f.Trends.Source = model.SourceSeed, model.SourceSeed
		out = append(out, f)
	}
	return out, nil
}

// NormalizeKeyword lowercases and collapses whitespace.
func NormalizeKeyword(k string) string {
	return strings.Join(strings.Fields(strings.ToLower(k)), " ")
}
