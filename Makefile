.PHONY: dev build start test seed smoke deploy
dev:
	./scripts/dev
build:
	./scripts/build
start:
	./scripts/start
test:
	./scripts/test
seed:
	./scripts/seed
smoke:
	./scripts/smoke
deploy:
	docker compose -f docker-compose.yml -f deploy/docker-compose.https.yml up -d --build
