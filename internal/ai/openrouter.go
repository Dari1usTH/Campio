// Package ai talks to OpenRouter (OpenAI-compatible chat completions API).
// The AI never produces numbers that drive decisions; it explains numbers
// computed by package analysis.
package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ErrNotConfigured is returned when no API key is set.
var ErrNotConfigured = errors.New("OPENROUTER_API_KEY is not set")

// Client is an OpenRouter client.
type Client struct {
	APIKey  string
	Model   string
	BaseURL string
	HTTP    *http.Client
}

// New creates a client.
func New(apiKey, model, baseURL string) *Client {
	return &Client{APIKey: apiKey, Model: model, BaseURL: strings.TrimRight(baseURL, "/"), HTTP: &http.Client{Timeout: 120 * time.Second}}
}

// Enabled reports whether an API key is configured.
func (c *Client) Enabled() bool { return c.APIKey != "" }

// Message is a chat message.
type Message struct {
	Role       string     `json:"role"`
	Content    string     `json:"content"`
	ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
	ToolCallID string     `json:"tool_call_id,omitempty"`
}

// ToolCall is a function call requested by the model.
type ToolCall struct {
	Index    int    `json:"index"`
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

// Tool is a function the model may call.
type Tool struct {
	Type     string       `json:"type"`
	Function ToolFunction `json:"function"`
}

// ToolFunction describes a callable function.
type ToolFunction struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Parameters  any    `json:"parameters"`
}

// Usage reports tokens and the real cost charged by OpenRouter.
type Usage struct {
	PromptTokens     int     `json:"prompt_tokens"`
	CompletionTokens int     `json:"completion_tokens"`
	Cost             float64 `json:"cost"`
	Details          struct {
		ReasoningTokens int `json:"reasoning_tokens"`
	} `json:"completion_tokens_details"`
}

// Add accumulates usage.
func (u *Usage) Add(o Usage) {
	u.PromptTokens += o.PromptTokens
	u.CompletionTokens += o.CompletionTokens
	u.Cost += o.Cost
}

// Request is a chat completion request.
type Request struct {
	Model          string    `json:"model"`
	Messages       []Message `json:"messages"`
	Tools          []Tool    `json:"tools,omitempty"`
	ToolChoice     any       `json:"tool_choice,omitempty"`
	ResponseFormat any       `json:"response_format,omitempty"`
	Temperature    float64   `json:"temperature"`
	MaxTokens      int       `json:"max_tokens,omitempty"`
	Stream         bool      `json:"stream,omitempty"`
	Usage          struct {
		Include bool `json:"include"`
	} `json:"usage"`
}

type apiError struct {
	Error *struct {
		Message string `json:"message"`
		Code    any    `json:"code"`
	} `json:"error"`
}

// Complete performs a non-streaming completion.
func (c *Client) Complete(ctx context.Context, req Request) (Message, Usage, error) {
	req.Stream = false
	resp, err := c.do(ctx, req)
	if err != nil {
		return Message{}, Usage{}, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return Message{}, Usage{}, err
	}
	var out struct {
		apiError
		Choices []struct {
			Message      Message `json:"message"`
			FinishReason string  `json:"finish_reason"`
		} `json:"choices"`
		Usage Usage `json:"usage"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return Message{}, Usage{}, fmt.Errorf("openrouter: decode: %w", err)
	}
	if out.Error != nil {
		return Message{}, out.Usage, fmt.Errorf("openrouter: %s", out.Error.Message)
	}
	if len(out.Choices) == 0 {
		return Message{}, out.Usage, errors.New("openrouter: no choices returned")
	}
	if fr := out.Choices[0].FinishReason; fr == "length" {
		return Message{}, out.Usage, fmt.Errorf("openrouter: response truncated at max_tokens=%d (completion_tokens=%d, reasoning_tokens=%d)",
			req.MaxTokens, out.Usage.CompletionTokens, out.Usage.Details.ReasoningTokens)
	}
	return out.Choices[0].Message, out.Usage, nil
}

// Stream performs a streaming completion, calling onDelta for each content
// fragment, and returns the assembled message (including tool calls).
func (c *Client) Stream(ctx context.Context, req Request, onDelta func(string)) (Message, Usage, error) {
	req.Stream = true
	resp, err := c.do(ctx, req)
	if err != nil {
		return Message{}, Usage{}, err
	}
	defer resp.Body.Close()

	msg := Message{Role: "assistant"}
	var usage Usage
	var content strings.Builder
	calls := map[int]*ToolCall{}
	var order []int

	sc := bufio.NewScanner(resp.Body)
	sc.Buffer(make([]byte, 0, 64*1024), 4<<20)
	for sc.Scan() {
		line := sc.Text()
		if !strings.HasPrefix(line, "data:") {
			continue // comments such as ": OPENROUTER PROCESSING"
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			break
		}
		var chunk struct {
			apiError
			Choices []struct {
				Delta struct {
					Content   string     `json:"content"`
					ToolCalls []ToolCall `json:"tool_calls"`
				} `json:"delta"`
			} `json:"choices"`
			Usage *Usage `json:"usage"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if chunk.Error != nil {
			return msg, usage, fmt.Errorf("openrouter: %s", chunk.Error.Message)
		}
		if chunk.Usage != nil {
			usage = *chunk.Usage
		}
		for _, ch := range chunk.Choices {
			if ch.Delta.Content != "" {
				content.WriteString(ch.Delta.Content)
				if onDelta != nil {
					onDelta(ch.Delta.Content)
				}
			}
			for _, tc := range ch.Delta.ToolCalls {
				cur, ok := calls[tc.Index]
				if !ok {
					cur = &ToolCall{Index: tc.Index, Type: "function"}
					calls[tc.Index] = cur
					order = append(order, tc.Index)
				}
				if tc.ID != "" {
					cur.ID = tc.ID
				}
				if tc.Function.Name != "" {
					cur.Function.Name = tc.Function.Name
				}
				cur.Function.Arguments += tc.Function.Arguments
			}
		}
	}
	if err := sc.Err(); err != nil {
		return msg, usage, fmt.Errorf("openrouter: stream: %w", err)
	}
	msg.Content = content.String()
	for _, i := range order {
		msg.ToolCalls = append(msg.ToolCalls, *calls[i])
	}
	return msg, usage, nil
}

func (c *Client) do(ctx context.Context, req Request) (*http.Response, error) {
	if !c.Enabled() {
		return nil, ErrNotConfigured
	}
	if req.Model == "" {
		req.Model = c.Model
	}
	req.Usage.Include = true
	b, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	hr, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/chat/completions", bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	hr.Header.Set("Authorization", "Bearer "+c.APIKey)
	hr.Header.Set("Content-Type", "application/json")
	hr.Header.Set("HTTP-Referer", "https://github.com/tibi/hackathon")
	hr.Header.Set("X-Title", "Merita lansat? - eMAG launch advisor")
	resp, err := c.HTTP.Do(hr)
	if err != nil {
		return nil, fmt.Errorf("openrouter: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		var e apiError
		if json.Unmarshal(body, &e) == nil && e.Error != nil {
			return nil, fmt.Errorf("openrouter: status %d: %s", resp.StatusCode, e.Error.Message)
		}
		return nil, fmt.Errorf("openrouter: status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return resp, nil
}
