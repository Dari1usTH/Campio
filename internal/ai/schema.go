package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

// Tiny JSON-schema builders for strict structured outputs.

func sStr() map[string]any             { return map[string]any{"type": "string"} }
func sInt() map[string]any             { return map[string]any{"type": "integer"} }
func sNum() map[string]any             { return map[string]any{"type": "number"} }
func sEnum(v ...string) map[string]any { return map[string]any{"type": "string", "enum": v} }
func sArr(items map[string]any) map[string]any {
	return map[string]any{"type": "array", "items": items}
}
func sObj(props map[string]any) map[string]any {
	req := make([]string, 0, len(props))
	for k := range props {
		req = append(req, k)
	}
	sort.Strings(req)
	return map[string]any{"type": "object", "properties": props, "required": req, "additionalProperties": false}
}

// structured performs a strict JSON-schema completion and decodes it into out.
func (c *Client) structured(ctx context.Context, name, system, user string, schema map[string]any, maxTokens int, out any) (Usage, error) {
	req := Request{
		Messages:    []Message{{Role: "system", Content: system}, {Role: "user", Content: user}},
		Temperature: 0.6,
		MaxTokens:   maxTokens,
		ResponseFormat: map[string]any{
			"type":        "json_schema",
			"json_schema": map[string]any{"name": name, "strict": true, "schema": schema},
		},
	}
	return c.complete(ctx, name, req, out)
}

// complete runs a JSON-schema request and decodes the answer into out.
func (c *Client) complete(ctx context.Context, name string, req Request, out any) (Usage, error) {
	msg, usage, err := c.Complete(ctx, req)
	if err != nil {
		return usage, err
	}
	if err := json.Unmarshal([]byte(extractJSON(msg.Content)), out); err != nil {
		return usage, fmt.Errorf("openrouter: invalid JSON from model for %s: %w", name, err)
	}
	return usage, nil
}

// extractJSON tolerates models that wrap JSON in markdown fences.
func extractJSON(s string) string {
	s = strings.TrimSpace(s)
	if i := strings.Index(s, "{"); i > 0 {
		s = s[i:]
	}
	if j := strings.LastIndex(s, "}"); j >= 0 && j < len(s)-1 {
		s = s[:j+1]
	}
	return s
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
