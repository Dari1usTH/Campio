.PHONY: deps run test build up down seed

DEV = docker compose -f docker-compose.yml -f docker-compose.dev.yml

deps:          ## Postgres + video worker (worker exposed on 127.0.0.1:8001 for go run)
	$(DEV) up -d --build db video-worker

run: deps      ## run the API locally (loads .env if present)
	set -a; [ -f .env ] && . ./.env; set +a; go run ./cmd/server

test:
	go test ./...

build:
	go build -o bin/server ./cmd/server

up:            ## full stack in Docker (worker isolated on an internal network)
	docker compose up -d --build

down:
	$(DEV) down

# Refresh precollected demo data from live eMAG + Google Trends:
#   make seed KW="suport laptop" FILE=suport-laptop
seed:
	go run ./cmd/seedgen "$(KW)" > "seed/$(FILE).json"
