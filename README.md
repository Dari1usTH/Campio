# Campio

One application for creating marketing campaigns: the existing React UI in `Frontend/`, the Go API in `Backend/`, and PostgreSQL. English is the default interface language; Romanian is available independently from the campaign content language.

Requires Docker Engine with Compose. Start the whole app with:

```sh
docker compose up --build
```

Open **http://localhost:8080**. Development verification and reset emails arrive in **http://localhost:8025** (Mailpit). Without an AI provider key, the backend logs `MOCK_AI` and produces bilingual demo campaigns. Browser services always call the real API and database.

To create the verified demo account with two campaigns and 2FA:

```sh
cp .env.example .env
# Set SEED_TEST_USER=true in .env, then:
docker compose up --build
```

The default account is `test@campio.app`. If `TEST_USER_PASSWORD` is empty, the seed prints a random password once when it creates the account. In development its OTP is `123456`. Keep that password private; it is not written to source files. Re-running seed preserves the existing password and demo content.

Root commands (also available through `make <command>`):

| Command | Purpose |
|---|---|
| `./scripts/dev` | Start PostgreSQL/Mailpit and both apps with hot reload (Node 22+, Go 1.27+) |
| `./scripts/build` | Build the static UI and server/seed binaries |
| `./scripts/start` | Run the built app with local `.env` configuration |
| `./scripts/test` | Typecheck, lint, unit tests, builds, Go vet/gofmt and secret scan |
| `./scripts/seed` | Idempotent seed, only with `SEED_TEST_USER=true` |
| `./scripts/seed --docker` | Run the seed inside the app container |
| `./scripts/smoke` | Playwright end-to-end tests against a running app |
| `make deploy` | Start app and Caddy HTTPS using the configured domain |

Run `npm ci` in `Frontend/` before the first local development session. The frontend dev server proxies `/api` to Go on port 8080; production serves both from the same origin. API sessions use httpOnly cookies. Secrets belong in ignored `.env` files or your deployment secret manager; no `VITE_*` variable may contain one.

See [the original audit](docs/AUDIT.md), [deployment instructions](docs/DEPLOY.md), and [handoff and verification](docs/HANDOFF.md). No public deployment target was supplied, so the repository includes a Docker host deployment instead.
