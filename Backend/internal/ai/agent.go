package ai

import (
	"context"
	"encoding/json"
	"fmt"
)

// ToolHandler executes a tool call. It returns the text given back to the
// model, an optional value kept by the caller, and stop=true to end the loop.
type ToolHandler func(ctx context.Context, name string, args json.RawMessage) (result string, keep any, stop bool, err error)

// AgentResult is the outcome of a tool-calling loop.
type AgentResult struct {
	Content string // concatenated assistant text
	Kept    []any  // values returned by tool handlers
	Usage   Usage
	Steps   int
}

// AgentOptions configures RunAgent.
type AgentOptions struct {
	Model       string
	Tools       []Tool
	MaxSteps    int
	MaxTokens   int
	Temperature float64
	// RequireTool forces a tool call on every turn (tool_choice "required").
	// If the model still answers with text only, it is nudged to continue
	// instead of ending the loop; only a handler returning stop=true ends it.
	RequireTool bool
	OnDelta     func(string)            // streamed assistant text (optional)
	OnToolCall  func(name, args string) // before executing a tool (optional)
	OnKeep      func(any)               // after a tool returned a kept value (optional)
}

// RunAgent runs a streaming tool-calling loop until the model answers without
// tool calls, a handler asks to stop, or MaxSteps is reached.
func (c *Client) RunAgent(ctx context.Context, msgs []Message, opt AgentOptions, handle ToolHandler) (AgentResult, error) {
	var res AgentResult
	if opt.MaxSteps <= 0 {
		opt.MaxSteps = 4
	}
	if opt.MaxTokens <= 0 {
		opt.MaxTokens = 2000
	}
	for step := 0; step < opt.MaxSteps; step++ {
		res.Steps = step + 1
		req := Request{Model: opt.Model, Messages: msgs, Tools: opt.Tools, Temperature: opt.Temperature, MaxTokens: opt.MaxTokens}
		if opt.RequireTool {
			req.ToolChoice = "required"
		}
		msg, usage, err := c.Stream(ctx, req, opt.OnDelta)
		res.Usage.Add(usage)
		if err != nil {
			return res, err
		}
		res.Content += msg.Content
		if len(msg.ToolCalls) == 0 {
			if !opt.RequireTool {
				return res, nil
			}
			msgs = append(msgs,
				Message{Role: "assistant", Content: msg.Content},
				Message{Role: "user", Content: "Continue now by calling a tool. Do not reply with text only; the session ends only when you call the finishing tool."})
			continue
		}
		msgs = append(msgs, Message{Role: "assistant", Content: msg.Content, ToolCalls: msg.ToolCalls})
		stop := false
		for _, tc := range msg.ToolCalls {
			args := json.RawMessage(tc.Function.Arguments)
			if len(args) == 0 {
				args = json.RawMessage("{}")
			}
			if opt.OnToolCall != nil {
				opt.OnToolCall(tc.Function.Name, string(args))
			}
			out, keep, st, err := handle(ctx, tc.Function.Name, args)
			if err != nil {
				out = mustJSON(map[string]string{"error": err.Error()})
			}
			if keep != nil {
				res.Kept = append(res.Kept, keep)
				if opt.OnKeep != nil {
					opt.OnKeep(keep)
				}
			}
			stop = stop || st
			msgs = append(msgs, Message{Role: "tool", ToolCallID: tc.ID, Content: out})
		}
		if stop {
			return res, nil
		}
	}
	return res, fmt.Errorf("openrouter: agent stopped after %d steps without finishing", opt.MaxSteps)
}
