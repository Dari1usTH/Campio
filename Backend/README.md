# Merită lansat? — backend

Go/Gin + PostgreSQL API that turns a product idea into a launch marketing kit for small eMAG.ro sellers. The kit
includes market insight, personas, positioning, copy, a 4-week campaign plan, A/B tests, and AI-generated short videos
that an AI editor assembles into finished reels.

| Step | Who does it |
|---|---|
| Market: competitors, prices, reviews, sellers (eMAG scraper) + 5-year trend (Google Trends) | code |
| Outside eMAG (best effort): Amazon.de search, Reddit discussions (Arctic Shift), BetaList launches | code |
| Complaints from reviews, 2–3 personas, positioning (complaint → message) | LLM (OpenRouter, structured JSON) |
| Listing titles and description, 3–5 ads, social posts, image ideas, video concepts with shots | LLM |
| Channel choice, 4-week calendar, A/B test ideas | LLM |
| Budget per channel, impressions, clicks, orders, ROAS, A/B sample size, cost and duration | **code** (fixed benchmarks, z-test) |
| Video clips per shot (product photo as first frame) | OpenRouter video model, default `google/veo-3.1` ($0.20/s without audio, 720p+) |
| Final reel: captions, transitions, end card with price | LLM writes Python, which runs in an isolated sandbox worker |
| Chat about the kit; budget what-ifs | LLM + deterministic `simulate_budget` tool |

Every kit reports what it cost (scraping, text AI, videos, editing) against the ad budget.

API contract and frontend guide: [openapi.yaml](openapi.yaml). The server also serves it at `GET /api/openapi.yaml`, with
Swagger UI at `/api/docs`.

## Run

```bash
cp .env.example .env            # set OPENROUTER_API_KEY
docker compose up -d --build    # db + video-worker + api on http://localhost:8080
```

Local development (API with `go run`; Postgres and the worker in Docker, with the worker exposed on 127.0.0.1:8001):

```bash
make run
make test
```

If port 5432 or 8080 is taken, set `POSTGRES_PORT` / `API_PORT` in `.env`. With `make run`, also update the port in
`DATABASE_URL`.

## Video editing sandbox ([worker/](worker))

The editor LLM gets two tools: `run_python(script)` and `finish(output, title, notes)`. Scripts run in the
`video-worker` container with Python 3.13, ffmpeg, Pillow, numpy and [`vidkit`](worker/vidkit.py) (`fit`, `concat` with
transitions, `text_overlay`, `captions`, `end_card`, `image_clip`, `add_audio`, …; text is rendered with Pillow, so
Romanian diacritics work).

Isolation:
- **Network:** the worker is only on an `internal` Docker network shared with the API. It has no internet and no
  route to Postgres (verified: openrouter.ai, 1.1.1.1 and `db` are all unreachable from inside).
- **Container:** read-only root filesystem, `/tmp` tmpfs, all capabilities dropped, `no-new-privileges`, 2 GB RAM,
  2 CPUs, 256 pids.
- **Per run:** a fresh temp directory, minimal environment, `python -I`, CPU/file-size/file-count rlimits, a wall-clock
  timeout that kills the whole process group, and 200 MB output cap. The worker is stateless: input files arrive with
  the request and outputs are returned, then everything is deleted.

`docker-compose.dev.yml` (used by `make run`) also exposes the worker on localhost, which gives it internet access.
Use it for development only.

## Demo

`GET /api/demo-cases` returns two presets (`suport laptop`, `husa iphone 16`). Their market data is precollected in
`seed/`, so it works offline. Refresh it from live sources with `make seed KW="suport laptop" FILE=suport-laptop`.

## Configuration

| Variable | Default | |
|---|---|---|
| `OPENROUTER_API_KEY` | – | Required for campaigns, videos, editing, chat |
| `OPENROUTER_MODEL` | `google/gemini-2.5-flash` | Text model (strategy, content, plan, chat) |
| `EDITOR_MODEL` | = `OPENROUTER_MODEL` | Video-editing agent |
| `VIDEO_MODEL` | `google/veo-3.1` | See `GET /api/video-models` (sorted by price) |
| `VIDEO_RESOLUTION` / `VIDEO_ASPECT_RATIO` | `480p` / `9:16` | |
| `WORKER_URL` | `http://localhost:8001` | Compose sets `http://video-worker:8000` |
| `MEDIA_DIR` | `data/media` | Compose uses the `media` volume |
| `DATABASE_URL`, `PORT`, `CORS_ORIGINS`, `SCRAPER_ENABLED`, `TRENDS_ENABLED`, `CACHE_TTL`, `SEED_DIR` | | as before |
| `AMAZON_ENABLED`, `AMAZON_DOMAIN`, `REDDIT_ENABLED`, `BETALIST_ENABLED` | `true`, `www.amazon.de` | web sources; each is skipped (not retried) when blocked |

## Layout

```
cmd/server             API entrypoint          cmd/seedgen   scrape a keyword → seed JSON
internal/analysis      deterministic math: market stats, budget/reach, A/B sizing, cost (+ tests)
internal/ai            OpenRouter: structured outputs, streaming tool-calling agent, video API + price catalog, prompts
internal/campaign      async kit pipeline, video jobs (poll/resume), AI editing sessions, uploads, chat
internal/sandbox       client for the worker          internal/media   file storage
internal/scraper/emag  eMAG search + product JSON-LD   internal/trends  Google Trends
internal/scraper/{amazon,reddit,betalist}  web sources, merged by internal/market/web.go
internal/market        cache → live → seed             internal/db      pgx, migrations, queries
internal/httpapi       Gin routes                      worker/          Python sandbox (server.py, vidkit.py)
```
