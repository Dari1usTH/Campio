# Docker deployment

No deployment host or domain credentials were supplied. These commands deploy the full Go/PostgreSQL application on your own Linux Docker host. Sites/Workers cannot run this Go binary or PostgreSQL server. Keep the original `Frontend/` capitalization.

## Local start

```sh
git clone git@github.com:Dari1usTH/Campio.git
cd Campio
cp .env.example .env
# Optional local demo: change SEED_TEST_USER=false to true.
docker compose up -d --build
docker compose ps
curl --fail http://localhost:8080/health
```

App: http://localhost:8080. Development mailbox: http://localhost:8025. See the first account password with `docker compose logs app` when no password was provided. Do not share these logs publicly. Migrations and the gated seed run on app startup; failures prevent startup. Data persists in named PostgreSQL and media volumes. `docker compose down` retains data; `down -v` deletes it.

## Public host prerequisites and required values

You must provide:

- A Linux host with Docker Engine/Compose, sufficient disk space, at least 2 GB RAM for builds, SSH access, and inbound TCP 80/443 (UDP443 optional).
- A domain whose A/AAAA records point to that host; `DOMAIN`, `APP_URL=https://your-domain`, `API_URL=https://your-domain/api`, and `CORS_ORIGINS=https://your-domain`.
- A random database password (`POSTGRES_PASSWORD`) and a random `SESSION_SECRET` of at least 32 bytes. `DATABASE_URL` for host tools must match the chosen database credentials; Compose sets the internal URL.
- Working SMTP host, port, username, password and verified sender (`SMTP_*`) for real verification/reset mail. Local Mailpit is not a public email provider.
- `GEMINI_API_KEY` for real text generation (or optional existing OpenRouter credentials). Without a provider the server explicitly uses demo AI; set `MOCK_AI=false` when real generation is intended.
- Google OAuth web client ID and secret if Google sign-in is needed. Register the exact callback `https://your-domain/api/auth/google/callback` with Google.
- `ACME_EMAIL` for Caddy HTTPS certificate notices.

All variables are documented in [.env.example](../.env.example). `SESSION_SECRET` is the session configuration secret; this application does not issue browser JWTs. Server storage paths are already set inside the image. `VITE_API_URL` is optional and defaults to same-origin `/api`; it is public, not a secret.

## Configure and deploy

After checking out the completed commits on the server:

```sh
cp .env.example .env
chmod 600 .env
openssl rand -hex 32
# Paste the output into SESSION_SECRET in .env.
openssl rand -hex 24
# Paste the output into POSTGRES_PASSWORD, updating DATABASE_URL for host tools.
# Edit .env with your domain and actual provider settings, including:
# APP_ENV=production
# APP_URL=https://campaigns.example.com
# API_URL=https://campaigns.example.com/api
# CORS_ORIGINS=https://campaigns.example.com
# DOMAIN=campaigns.example.com
# ACME_EMAIL=you@example.com
# SEED_TEST_USER=false
# ALLOW_TEST_OTP=false
# MOCK_AI=false
# SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_FROM
# GEMINI_API_KEY and optional GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET

docker compose -f docker-compose.yml -f deploy/docker-compose.https.yml config --quiet
docker compose -f docker-compose.yml -f deploy/docker-compose.https.yml up -d --build
docker compose ps
curl --fail https://campaigns.example.com/health
```

Caddy obtains and renews HTTPS certificates automatically and proxies API and SPA to the app on port 8080. PostgreSQL, mail inbox and direct app port bind only localhost. Persist Caddy volumes for renewal. Development Mailpit remains private and unused when SMTP is configured to your provider.

Optional original video editing:

```sh
docker compose --profile video -f docker-compose.yml -f deploy/docker-compose.https.yml up -d --build
```

This starts the existing resource-limited worker on its isolated network. Native OpenRouter video/editor features still need their provider key; they are separate from the text campaign demo.

## Demo account and OTP guard

`SEED_TEST_USER=true` creates the configured verified test user only once, adds demo campaigns/results/notifications/onboarding, and enables its 2FA flow. If `TEST_USER_PASSWORD` is empty, a strong password is printed only upon creation. Subsequent seeds preserve it.

The fixed `TEST_USER_OTP` (default `123456`) applies **only to the explicitly seeded test account**, and only if `APP_ENV` is not `production` **or** `ALLOW_TEST_OTP=true`. With `APP_ENV=production` and `ALLOW_TEST_OTP=false`, that bypass does not exist; use actual emailed codes/TOTP. Do not enable the override on a public service.

Before real customers: set `SEED_TEST_USER=false` and `ALLOW_TEST_OTP=false`, remove the seeded account through Settings or a controlled database operation, and recreate the app. Changing `SEED_TEST_USER` alone does not delete an existing test account. Do not include a reusable test password in deployment docs or Git.

## Verification and operations

```sh
./scripts/test
# Against the running local app; Playwright uses the private dev mailbox:
./scripts/smoke
# Remote verification requires an accessible test SMTP inbox and explicit E2E config.
docker compose logs --tail 100 app
```

Back up PostgreSQL with `pg_dump` and back up the media volume; treat backups as private user data. For example:

```sh
mkdir -p .local/backups
chmod 700 .local/backups
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > .local/backups/campio.sql
```

Before upgrades, back up, pull the intended commit, and run the same `up -d --build` command. Check `/health` and app logs; startup applies embedded transactional migrations. Preserve the previous image and backup for rollback; a schema rollback may require restoring the backup. Do not rewrite published Lovable history.
