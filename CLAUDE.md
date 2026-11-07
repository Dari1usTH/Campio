# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Go/Gin + PostgreSQL backend for a hackathon project. A small eMAG.ro seller sends one free-text prompt plus optional product photos. An intake step extracts the product, keyword, price and budget, and asks the seller questions for whatever is missing. The backend then produces a marketing kit:
- market insight (scraped eMAG data + Google Trends)
- personas and positioning
- copy (listing, ads, social posts)
- a 4-week campaign plan with A/B tests
- short vertical videos, generated with OpenRouter video models and assembled by an AI editor that writes Python run in a sandbox

The frontend lives in a separate repo and is built by another agent that has **no access to this repo**. Its only contract is [openapi.yaml](openapi.yaml) (embedded via `openapi.go` and served at `/api/openapi.yaml`, with Swagger UI at `/api/docs`).

## Commands

```bash
make run                  # Postgres + video worker in Docker (dev override), then `go run ./cmd/server` with .env loaded
docker compose up -d --build   # full stack: db, video-worker (isolated), api on :8080
make test                 # go test ./...
go test ./internal/analysis -run TestSizeABTest -v   # single test
go vet ./... && gofmt -l .
make seed KW="suport laptop" FILE=suport-laptop      # refresh seed data from live eMAG + Trends (cmd/seedgen)
npx -y @redocly/cli@1.34.3 lint openapi.yaml         # lint the API contract
```

Unit tests live only in `internal/analysis` and `internal/ai`; everything else was verified end to end.

## Architecture

**Core rule: code computes, the AI writes.** Every number shown to users is computed in `internal/analysis`: market stats, budget split normalized to 100%, impressions/clicks/orders/ROAS from the fixed `Benchmarks` table, A/B sample size (two-proportion z-test), and costs. The LLM picks strategy, channel percentages and test ideas, and writes copy. Prompts in `internal/ai` forbid inventing figures. Keep this split when adding features: new numbers go in `analysis`, and the AI is handed them as JSON.

**Request flow** (`cmd/server/main.go` wires everything):
- `internal/market.Service` resolves data for a keyword in order: live cache in the DB (TTL `CACHE_TTL`), then live scrape (`scraper/emag`, `trends`), then seed rows loaded at startup from `seed/*.json`. This is what keeps the demo from failing.
  - The eMAG selectors are all in `scraper/emag/emag.go`. Search cards use `div.card-item`; product pages are parsed from their JSON-LD block.
  - Trends uses the unofficial `explore` → `widgetdata/multiline` endpoints. For low-volume keywords it retries with the first two words.
- `internal/campaign` holds the orchestration. All long work runs in background goroutines (`Service.wg`), and clients poll:
  - `service.go`: `Create(prompt, images)` stores the images as `product_image` uploads and returns 202 immediately. `run` executes the steps intake → market → strategy → content → plan, and saves the partial `Kit` JSON to `campaigns.kit` after each step so the frontend renders progressively. Live fields (status, cost) are filled in by `Get`.
  - `intake.go`: the clarification dialogue. `ai.Intake` (vision) reads the prompt, images and previous answers. `buildQuestions` decides what to ask: essential fields (product, keyword, price, budget) until known or skipped, and the AI's optional questions only in round 1. The run pauses with status `needs_input`. `Answer` (POST `/answers`) appends to `intake.answers`, claims the campaign atomically (`ResumeCampaign`) and re-runs `run`, which skips market if the keyword is unchanged. The seller's answers override the AI, and amounts are parsed by `analysis.ParseAmount`. Skipped price/budget become the eMAG median / `DefaultAdBudgetRON` and are noted in `intake.assumptions`. There are max 3 rounds. An eMAG keyword with no results triggers a keyword question instead of failing.
  - `videos.go`: one OpenRouter video job per shot. Each asset is polled until done, then downloaded into `MEDIA_DIR`. `ResumeVideoJobs` restarts polling at boot. The product photo is sent as a `first_frame` data URL.
  - `edits.go`: the editing agent loop (`ai.RunAgent` with tools `run_python` and `finish`). Inputs get predictable sandbox names (`clip_v1_shot1.mp4`, `product_image_1.png`, …). Outputs of one run are re-sent as inputs to the next. Each step is appended to `edits.steps` for the live log.
  - `chat.go`: chat with a deterministic `simulate_budget` tool.
- `internal/ai`:
  - `openrouter.go`: chat completions, in both streaming and non-streaming form, with streamed tool-call assembly. Costs come from `usage.include`.
  - `schema.go` / `marketing.go` / `intake.go`: the strict JSON-schema calls (intake, strategy, content, plan). `Message.Parts` sends multimodal content (text + `image_url` data URLs).
  - `agent.go`: the generic tool loop.
  - `video.go`: the `/videos` API, plus a model catalog with per-second price parsing from `pricing_skus`.
  - `prompts.go`: all prompts. Seller-facing text is Romanian; the editor prompt and video prompts are English.
- `internal/db`: pgx with no ORM. Migrations are embedded SQL in `internal/db/migrations`, applied in filename order and tracked in `schema_migrations`. Add a new numbered file rather than editing `001_init.sql`.
  - Interrupted campaigns and edits are marked failed at startup (`FailInterrupted`). Campaigns in `needs_input` are left alone.
- `internal/httpapi`: Gin routes. Errors always use `{"error":{"code","message"}}`, mapped from sentinel errors in `failErr` (`campaign.ErrInvalid`, `ErrNotReady`, `db.ErrNotFound`, `market.ErrNoData`, `ai.ErrNotConfigured`).

**Video worker** (`worker/`, Python stdlib server + ffmpeg + Pillow):
- It is stateless. `POST /run` takes the script plus base64 files and returns the files written to `./out/`.
- `vidkit.py` is the helper API the editor LLM is told about. Its function list is duplicated in the `EditorSystem` prompt in `internal/ai/prompts.go`, so **update both together**.
- Security model: in `docker-compose.yml` the worker is only on the `internal: true` network `sandbox` (no internet, no DB), with a read-only filesystem, all capabilities dropped and resource limits; each run also gets rlimits and a timeout. `docker-compose.dev.yml` exposes it on 127.0.0.1:8001 for `go run`, which also gives it internet access, so use that only for development.

## Conventions and gotchas

- Changing any API response shape means updating `openapi.yaml`. The external frontend agent relies on it, including the "Frontend guide" in `info.description`. Keep YAML flow-map descriptions quoted, because commas break parsing.
- Money is RON unless the field ends in `_usd`. Percentages are 0–100.
- Asset `kind`: `generated` | `edited` | `upload`. Upload `role`: `product_image` | `logo` | `music` | `footage`.
- Without `OPENROUTER_API_KEY`, the market endpoints still work, but campaigns, videos, edits and chat return 503 `ai_unavailable`.
- The compose project is named `merita-lansat` on purpose, so it can't collide with another compose project in a folder called `backend`.
- Testing without a key: point `OPENROUTER_URL` at a local mock that implements `/chat/completions` (with `response_format` json_schema names `intake` / `strategy` / `content` / `campaign_plan`, plus streamed tool calls) and `/videos*`. Set `SCRAPER_ENABLED=false TRENDS_ENABLED=false` to force seed data, and `VIDEO_POLL_EVERY=1s`.
