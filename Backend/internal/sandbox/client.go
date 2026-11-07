// Package sandbox calls the isolated Python video worker (see worker/).
package sandbox

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// MaxInputBytes caps the files sent per run.
const MaxInputBytes = 250 << 20

// Client talks to the worker.
type Client struct {
	URL  string
	HTTP *http.Client
}

// New creates a client.
func New(url string) *Client {
	return &Client{URL: url, HTTP: &http.Client{Timeout: 6 * time.Minute}}
}

// Probe is ffprobe info of an output file.
type Probe struct {
	Duration float64 `json:"duration"`
	Width    int     `json:"width"`
	Height   int     `json:"height"`
	FPS      float64 `json:"fps"`
	HasAudio bool    `json:"has_audio"`
}

// Output is a file written by the script to ./out/.
type Output struct {
	Name  string `json:"name"`
	Size  int64  `json:"size"`
	Probe *Probe `json:"probe,omitempty"`
	Data  []byte `json:"-"`
}

// Result of a run.
type Result struct {
	ExitCode   int      `json:"exit_code"`
	TimedOut   bool     `json:"timed_out"`
	Stdout     string   `json:"stdout"`
	Stderr     string   `json:"stderr"`
	DurationMS int64    `json:"duration_ms"`
	Outputs    []Output `json:"outputs"`
}

// Health checks the worker.
func (c *Client) Health(ctx context.Context) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, c.URL+"/health", nil)
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("worker health: status %d", resp.StatusCode)
	}
	return nil
}

// Run executes script with the given input files (name → local path).
func (c *Client) Run(ctx context.Context, script string, files map[string]string, timeoutS int) (Result, error) {
	type file struct {
		Name string `json:"name"`
		B64  string `json:"b64"`
	}
	body := struct {
		Script   string `json:"script"`
		TimeoutS int    `json:"timeout_s"`
		Files    []file `json:"files"`
	}{Script: script, TimeoutS: timeoutS}
	total := 0
	for name, path := range files {
		b, err := os.ReadFile(path)
		if err != nil {
			return Result{}, fmt.Errorf("read input %s: %w", filepath.Base(path), err)
		}
		total += len(b)
		if total > MaxInputBytes {
			return Result{}, errors.New("sandbox: input files too large")
		}
		body.Files = append(body.Files, file{Name: name, B64: base64.StdEncoding.EncodeToString(b)})
	}
	payload, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.URL+"/run", bytes.NewReader(payload))
	if err != nil {
		return Result{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return Result{}, fmt.Errorf("sandbox: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 600<<20))
	if err != nil {
		return Result{}, err
	}
	if resp.StatusCode != http.StatusOK {
		var e struct{ Error string }
		_ = json.Unmarshal(raw, &e)
		return Result{}, fmt.Errorf("sandbox: status %d: %s", resp.StatusCode, e.Error)
	}
	var out struct {
		Result
		Outputs []struct {
			Output
			B64 string `json:"b64"`
		} `json:"outputs"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return Result{}, fmt.Errorf("sandbox: decode: %w", err)
	}
	res := out.Result
	res.Outputs = nil
	for _, o := range out.Outputs {
		data, err := base64.StdEncoding.DecodeString(o.B64)
		if err != nil {
			return Result{}, fmt.Errorf("sandbox: output %s: %w", o.Name, err)
		}
		o.Output.Data = data
		res.Outputs = append(res.Outputs, o.Output)
	}
	return res, nil
}
