# ============================================================
# ITSM Platform — Makefile
# ============================================================
# Usage:
#   make help          — list all commands
#   make install       — install dependencies
#   make dev           — start dev server
#   make docker-up     — start all services via Docker Compose
#   make test          — run all tests
#   make migrate       — run Prisma migrations
#   make seed          — seed the database
# ============================================================

.PHONY: help install dev build start \
        docker-up docker-down docker-logs docker-reset docker-build \
        migrate migrate-reset seed generate \
        test test-unit test-integration test-watch test-coverage \
        lint format clean

# ─── Meta ────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  ITSM Platform — Available Commands"
	@echo "  ────────────────────────────────────"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*?##/ { printf "  %-22s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""

# ─── Installation ────────────────────────────────────────────────────────────
install: ## Install Node.js dependencies
	npm install

# ─── Development ─────────────────────────────────────────────────────────────
dev: ## Start development server with hot-reload
	npm run dev

build: ## (No build step — pure Node.js)
	@echo "No build step required."

start: ## Start production server
	npm start

# ─── Docker ──────────────────────────────────────────────────────────────────
docker-up: ## Start all services (PostgreSQL, Redis, API) via Docker Compose
	docker compose up -d
	@echo "✅  Services started. API: http://localhost:3000"
	@echo "    Swagger UI: http://localhost:3000/api-docs"

docker-up-dev: ## Start with development overrides (nodemon, mounted source)
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

docker-down: ## Stop all services
	docker compose down

docker-reset: ## Stop services, remove volumes, and restart fresh
	docker compose down -v
	docker compose up -d

docker-logs: ## Tail API container logs
	docker compose logs -f api

docker-build: ## Rebuild the API container image
	docker compose build api

docker-migrate: ## Run migrations inside the migrate container
	docker compose run --rm migrate

docker-seed: ## Seed the database via Docker
	docker compose exec api node prisma/seed.js

docker-shell: ## Open a shell inside the API container
	docker compose exec api sh

# ─── Database ────────────────────────────────────────────────────────────────
migrate: ## Apply pending Prisma migrations
	npx prisma migrate dev

migrate-deploy: ## Deploy migrations (production)
	npx prisma migrate deploy

migrate-reset: ## Reset the database and re-apply all migrations
	npx prisma migrate reset --force

generate: ## Regenerate Prisma client after schema change
	npx prisma generate

seed: ## Seed the database with demo data
	node prisma/seed.js

studio: ## Open Prisma Studio (visual DB browser)
	npx prisma studio

# ─── Testing ─────────────────────────────────────────────────────────────────
test: ## Run all tests (unit + integration)
	npm test

test-unit: ## Run unit tests only
	npx jest __tests__/unit --forceExit

test-integration: ## Run integration tests only (requires running DB + Redis)
	npx jest __tests__/integration --forceExit --runInBand

test-watch: ## Run tests in watch mode
	npx jest --watch

test-coverage: ## Run tests with coverage report
	npx jest --coverage --forceExit

# ─── Code Quality ────────────────────────────────────────────────────────────
lint: ## Lint source files
	npx eslint src --ext .js

format: ## Format source files with Prettier
	npx prettier --write "src/**/*.js" "__tests__/**/*.js"

# ─── Utility ─────────────────────────────────────────────────────────────────
clean: ## Remove node_modules, coverage, and log files
	rm -rf node_modules coverage logs/*.log

env: ## Copy .env.example to .env (first-time setup)
	cp .env.example .env
	@echo "✅  .env created. Edit it with your configuration."
