# Campio integration audit — 2026-11-07

This records the original state, before application changes. The supplied checkout already moves the tracked Go backend from the repository root into `Backend/` and adds the previously untracked Lovable UI in `Frontend/`. Preserve these user changes and their history; folder casing is retained for Linux compatibility. No deployment host, domain or credentials were supplied.

## Stack, commands and build

| Side | Existing stack | Run / checks / output |
|---|---|---|
| UI | React 19.2, TypeScript 5.8, TanStack Start 1.168.60 / Router 1.170.41, Query 5.101, Vite 8.1.5, Tailwind 4.2, Radix/shadcn, React Hook Form 7.71, Zod 3.25 | `cd Frontend && npm ci && npm run dev`; typecheck, lint, vitest, production build. Existing Lovable build targets SSR/Nitro Cloudflare rather than a static SPA. |
| API | Go module declares 1.27.1, Gin 1.12, pgx 5.12, PostgreSQL 17, OpenRouter Gemini text/video clients | `cd Backend && go run ./cmd/server`; `go test ./...`, `go vet ./...`, `go build ./cmd/server`; embedded migrations on startup. Existing Dockerfile builds only API. |
| Video sandbox | Python 3.13, ffmpeg, Pillow, isolated HTTP worker | Existing Backend compose starts db, video-worker, api; worker has no internet or DB network. |

Host: Node 22.22.2, npm 11.19, Go 1.26.7 (automatic requested-toolchain download being checked), Docker 28.5.2 / Compose 5.5.1 with usable daemon, system Chromium 150, Python Playwright installed. Baseline frontend typecheck and 41 unit tests pass; those tests predominantly exercise mocks. Existing backend tests cover analysis and video helpers.

## Existing backend endpoints

All paths below begin `/api`. **Every original endpoint is unauthenticated and campaign data is global.** Existing error envelope is `{error:{code,message}}` with stable codes `invalid_request`, `not_found`, `not_ready`, `not_waiting`, `no_market_data`, `ai_unavailable`, `ai_error`, `timeout`, `internal`.

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/health` | none | database, video_worker, AI and scraper status; 503 on DB failure |
| GET | `/openapi.yaml`, `/docs` | none | OpenAPI YAML / Swagger HTML |
| GET | `/methodology`, `/demo-cases` | none | deterministic benchmarks / seed market cases |
| GET | `/market` | `keyword` query | snapshot, stats, products, reviews |
| GET | `/trends` | `keyword` query | geo, stats, trend points |
| GET | `/video-models` | none | model defaults, price-sorted items |
| POST | `/campaigns` | JSON `{prompt}` or multipart `prompt`, `images[]` | 202 `Kit` |
| GET | `/campaigns` | `limit`, `offset` | `{items:Kit[],total,limit,offset}` |
| GET | `/campaigns/:id` | UUID | `Kit` |
| DELETE | `/campaigns/:id` | UUID | 204 |
| POST | `/campaigns/:id/answers` | `{answers:[{question_id,value,skip}],message?}` | 202 `Kit` |
| POST | `/campaigns/:id/budget-simulation` | `{total_budget_ron?,shares?}` | calculated channels and totals |
| GET | `/campaigns/:id/messages` | UUID | message items |
| POST | `/campaigns/:id/messages` | `{message}`, optional streaming | ChatReply / SSE |
| GET | `/campaigns/:id/assets` | UUID | asset items |
| POST | `/campaigns/:id/uploads` | multipart file, role | 201 Asset |
| POST | `/campaigns/:id/videos` | `{concept_id,...}` | 202 asset items |
| GET | `/campaigns/:id/edits` | UUID | edit items |
| POST | `/campaigns/:id/edits` | `{concept_id,instructions?,...}` | 202 Edit |
| GET | `/assets/:id` | UUID | Asset metadata |
| GET | `/assets/:id/content` | `download=1` optional, byte ranges | asset bytes |
| GET | `/edits/:id` | UUID | Edit |

`Kit` uses snake_case: `id,created_at,updated_at,status,step,error,steps,input,intake,market,trend,strategy,content,plan,ai_model,cost`. Its async states are `running`, `needs_input`, `completed`, `failed`; steps intake/market/strategy/content/plan/done. Input includes prompt, product_name, keyword, product_description, sale_price, ad_budget_ron, brand_name, image_asset_ids. Personas live in strategy; ads and copy in content; computed budget/KPI forecasts in plan. Asset/Edit shapes and full nested schema are in `Backend/openapi.yaml` and `internal/campaign/kit.go`.

## Existing frontend service calls and mocks

`src/services/api.ts` enables mocks whenever `VITE_API_URL` is empty. HTTP JSON is mostly cast; only auth and some campaign boundaries use Zod. Errors incorrectly expect top-level message/code. Tokens, sessions, campaigns, settings and notifications persist in localStorage. All delays, authentication and generation are simulated.

| Service | Calls expected by UI | Mock behavior |
|---|---|---|
| auth | POST `/auth/signup`, `/auth/login`, `/auth/google`; POST `/auth/2fa/method`, `/auth/2fa/resend`, `/auth/2fa/verify`; POST `/auth/logout` | fabricated Challenge/session, any valid credentials, almost any 6 digit OTP, pretend Google login, backup codes |
| recovery | POST `/auth/forgot`, GET `/auth/reset/validate?token`, POST `/auth/reset` | no email; special demo/invalid/expired tokens |
| wizard | POST `/wizard/parse` | local regex product/category/price/strength extraction |
| campaigns | GET/POST `/campaigns`, GET/PATCH/DELETE `/campaigns/:id` | localStorage campaign records from `mock-data.ts` |
| generation | GET `/campaigns/:id/generation` | elapsed-time progress and fictional panel/agent scores |
| checklist | POST `/campaigns/:id/warnings/:warningId/toggle`, `/campaigns/:id/channels/:channelId/actions/:actionId/toggle` | local record mutation |
| results | POST `/campaigns/:id/results`, GET `/campaigns/:id/results/analysis` | locally calculated next-step suggestions |
| notifications | GET `/notifications`, POST `/notifications/read` | fake notifications |
| settings | GET/PATCH `/settings`, POST `/settings/password`, DELETE `/settings/account` | fabricated sessions/integration connections, local preferences |

Pages: landing; signup/login/OTP/forgot/reset; dashboard; wizard; live generation; result; real results; history/compare; assets; settings; share snapshot. There is no existing auth guard on `/app`. Onboarding/activity state is local; canvas PNG is client-generated, video sections are placeholders. Several demo campaign IDs are hardcoded in navigation.

UI `Campaign` is camelCase and requires product, marketplaces, goal, budget, tone, durationDays, health, segments, positioning, keyMessage, tones, messages with heuristic scores, warnings, agentRounds, channels/actions, ready copy, KPIs, costUsd and optional actual results. UI campaign states are draft/generating/ready/launched. **This does not match a backend Kit.**

## Mismatches and missing features

1. API base prefix `/api`; frontend paths omit it. Campaign request/response/list envelope/statuses are incompatible. Adapt UI boundary to the native Kit and persist only necessary UI draft/checklist/results metadata.
2. Missing users, verified emails, passwords, session cookies/refresh, OAuth, 2FA, resets, profile/preferences, account deletion, notifications and campaign ownership require new backend features.
3. Missing parse endpoint, frontend generation polling shape, campaign patch/checklist/results/analysis require endpoints or native adapters. Preserve deterministic existing budget and marketing logic.
4. Existing error envelope ignored. Centralize code-to-translated-message handling; never show raw upstream/internal errors.
5. Existing ro-only globals (`i18n/ro.ts`, feature `copy.ts`) plus hardcoded Romanian are not reactive. HTML language and SEO are fixed Romanian. No UI switch or per-user language; number/date formatting is inconsistent.
6. AI only supports OpenRouter, all prompts Romanian; missing direct Gemini key, independent campaign language and a server demo mode when unconfigured.
7. No real email/OAuth providers configured; original authenticator QR is a placeholder. Implement real delivery/TOTP/OAuth and explicit unavailable states when external configuration is absent.
8. Current build is SSR-targeted; produce static SPA served with API by Go, preserving existing routes/components and generated-file policy.
9. No root compose/dev/build/start/test/seed deployment, unified health or seeded user. Existing backend-only worker can remain optional for video.
10. No E2E coverage, secret scan or production OTP guard check. Existing mock tests must be replaced with real contracts.

## Database and migrations

PostgreSQL via pgx. Embedded `Backend/internal/db/migrations/001_init.sql` applied transactionally in filename order and recorded in schema_migrations. Tables: market_snapshots, trend_series, campaigns (Kit JSONB), assets (campaign FK), edits (campaign FK), chat_messages (campaign FK). No user data, ownership, session/token/OTP storage, results or preferences. Startup loads idempotent market seeds (`seed/husa-iphone-16.json`, `seed/suport-laptop.json`) and marks interrupted jobs failed. No Supabase/Drizzle changes are needed.

## Original environment

Frontend: `VITE_API_URL` (public browser API base; never store provider keys here). Backend: `PORT`, `DATABASE_URL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_URL`, `CORS_ORIGINS`, `SCRAPER_ENABLED`, `TRENDS_ENABLED`, `CACHE_TTL`, `SEED_DIR`, `MEDIA_DIR`, `WORKER_URL`, `VIDEO_MODEL`, `VIDEO_RESOLUTION`, `VIDEO_ASPECT_RATIO`, `VIDEO_POLL_EVERY`, `EDITOR_MODEL`. Compose: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `API_PORT`. Root example documents only a subset. New auth/session, APP_URL/API_URL, APP_ENV, Gemini, SMTP, OAuth and gated test-user variables will be documented in the final root `.env.example`.

## Plan and decisions

1. Commit this audit and preserve the supplied directory relocation as the baseline.
2. In parallel add exhaustive reactive EN/RO localization, adapt frontend real services/auth guard/static build, and implement missing backend identity/storage/localized campaign support. Use same-origin httpOnly session cookies, origin/CSRF checks, rate limits and strong password hashing. Preserve existing API business logic.
3. Add unified multi-stage Docker/Compose with PostgreSQL, root scripts, optional video worker and Caddy HTTPS deployment. Migrate and gated idempotent seed on startup.
4. Run typecheck/lint/unit/build and browser smoke at 375/768/1280; verify bilingual generation, ownership and production fixed-OTP rejection; scan staged files for secrets.
5. With no target supplied, deliver exact Docker-host deployment commands and a factual handoff listing external values and any verification limits. Never claim a live deployment without one.

Repository guidance: `Frontend/AGENTS.md` forbids rewriting published history and manually editing generated code; preserve those restrictions. The explicit task authorizes backend migrations and Gemini calls, which take precedence over Lovable defaults for Supabase/gateway-managed projects. Sites hosting requires static or Worker output and cannot host this Go/PostgreSQL app; Docker is the requested deployment fallback.
