// Command seedgen runs the live eMAG scraper and Google Trends client for a
// keyword and prints a seed file. Use it to refresh precollected demo data:
//
//	go run ./cmd/seedgen "suport laptop" > seed/suport-laptop.json
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/tibi/hackathon/backend/internal/scraper/emag"
	"github.com/tibi/hackathon/backend/internal/seed"
	"github.com/tibi/hackathon/backend/internal/trends"
)

func main() {
	kw := strings.Join(os.Args[1:], " ")
	if kw == "" {
		fmt.Fprintln(os.Stderr, "usage: seedgen <keyword>")
		os.Exit(2)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	snap, err := emag.New().Scrape(ctx, kw)
	if err != nil {
		fmt.Fprintln(os.Stderr, "emag error:", err)
		os.Exit(1)
	}
	ts, err := trends.New().Fetch(ctx, kw)
	if err != nil {
		fmt.Fprintln(os.Stderr, "trends error (seed will have no trend):", err)
	}
	snap.Source, ts.Source = "seed", "seed"
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)
	_ = enc.Encode(seed.File{Keyword: kw, Market: snap, Trends: ts})
}
