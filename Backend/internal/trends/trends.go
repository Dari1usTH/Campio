// Package trends fetches Google Trends interest-over-time via the unofficial
// web endpoints (explore -> widget token -> widgetdata/multiline).
package trends

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strconv"
	"time"

	"github.com/tibi/hackathon/backend/internal/model"
)

const (
	base      = "https://trends.google.com"
	userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)

// Client is a Google Trends client.
type Client struct {
	Geo       string
	Timeframe string
}

// New returns a client for Romania over 5 years.
func New() *Client { return &Client{Geo: "RO", Timeframe: "today 5-y"} }

// Fetch returns the weekly interest series for keyword.
func (c *Client) Fetch(ctx context.Context, keyword string) (model.TrendSeries, error) {
	ts := model.TrendSeries{Keyword: keyword, Geo: c.Geo, Source: model.SourceLive, FetchedAt: time.Now().UTC()}
	jar, _ := cookiejar.New(nil)
	hc := &http.Client{Timeout: 15 * time.Second, Jar: jar}

	// Warm-up request sets the NID cookie Google requires.
	_, _ = c.get(ctx, hc, base+"/trends/?geo="+c.Geo, nil)

	reqJSON, _ := json.Marshal(map[string]any{
		"comparisonItem": []map[string]string{{"keyword": keyword, "geo": c.Geo, "time": c.Timeframe}},
		"category":       0,
		"property":       "",
	})
	q := url.Values{"hl": {"ro"}, "tz": {"-120"}, "req": {string(reqJSON)}}
	body, err := c.get(ctx, hc, base+"/trends/api/explore", q)
	if err != nil {
		return ts, err
	}
	var explore struct {
		Widgets []struct {
			ID      string          `json:"id"`
			Token   string          `json:"token"`
			Request json.RawMessage `json:"request"`
		} `json:"widgets"`
	}
	if err := json.Unmarshal(stripPrefix(body), &explore); err != nil {
		return ts, fmt.Errorf("trends: explore: %w", err)
	}
	var token string
	var wreq json.RawMessage
	for _, w := range explore.Widgets {
		if w.ID == "TIMESERIES" {
			token, wreq = w.Token, w.Request
		}
	}
	if token == "" {
		return ts, errors.New("trends: TIMESERIES widget not found")
	}

	q = url.Values{"hl": {"ro"}, "tz": {"-120"}, "req": {string(wreq)}, "token": {token}}
	body, err = c.get(ctx, hc, base+"/trends/api/widgetdata/multiline", q)
	if err != nil {
		return ts, err
	}
	var data struct {
		Default struct {
			TimelineData []struct {
				Time  string `json:"time"`
				Value []int  `json:"value"`
			} `json:"timelineData"`
		} `json:"default"`
	}
	if err := json.Unmarshal(stripPrefix(body), &data); err != nil {
		return ts, fmt.Errorf("trends: multiline: %w", err)
	}
	for _, p := range data.Default.TimelineData {
		sec, err := strconv.ParseInt(p.Time, 10, 64)
		if err != nil || len(p.Value) == 0 {
			continue
		}
		ts.Points = append(ts.Points, model.TrendPoint{
			Date:  time.Unix(sec, 0).UTC().Format("2006-01-02"),
			Value: p.Value[0],
		})
	}
	if len(ts.Points) == 0 {
		return ts, errors.New("trends: empty series")
	}
	return ts, nil
}

func (c *Client) get(ctx context.Context, hc *http.Client, u string, q url.Values) ([]byte, error) {
	if q != nil {
		u += "?" + q.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept-Language", "ro-RO,ro;q=0.9")
	resp, err := hc.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("trends: GET %s: status %d", u, resp.StatusCode)
	}
	return b, nil
}

// stripPrefix removes Google's anti-XSSI prefix `)]}'` (and optional comma).
func stripPrefix(b []byte) []byte {
	if i := bytes.IndexByte(b, '\n'); i >= 0 && bytes.HasPrefix(b, []byte(")]}'")) {
		return b[i+1:]
	}
	return b
}
