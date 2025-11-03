.PHONY: help install build dev clean lint typecheck test
.PHONY: docker-build docker-up docker-down docker-deploy docker-logs
.PHONY: fly-deploy railway-deploy
.PHONY: db-migrate db-backup db-restore storage-backup
.PHONY: setup-webhooks scale-workers

help:
	@echo "Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make install          - Install all dependencies"
	@echo "  make build            - Build all packages and services"
	@echo "  make dev              - Run all services in development mode"
	@echo "  make clean            - Clean build artifacts"
	@echo "  make lint             - Run linting"
	@echo "  make typecheck        - Run TypeScript type checking"
	@echo "  make test             - Run tests"
	@echo ""
	@echo "Docker Commands:"
	@echo "  make docker-build     - Build Docker images"
	@echo "  make docker-up        - Start services with Docker Compose"
	@echo "  make docker-down      - Stop services with Docker Compose"
	@echo "  make docker-deploy    - Deploy with Docker Compose (production)"
	@echo "  make docker-logs      - View Docker logs"
	@echo ""
	@echo "Deployment:"
	@echo "  make fly-deploy       - Deploy to Fly.io"
	@echo "  make railway-deploy   - Deploy to Railway"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate       - Run database migrations"
	@echo "  make db-backup        - Backup PostgreSQL database"
	@echo "  make db-restore FILE=<backup.sql.gz> - Restore database from backup"
	@echo ""
	@echo "Storage:"
	@echo "  make storage-backup   - Backup S3/storage"
	@echo ""
	@echo "Operations:"
	@echo "  make setup-webhooks   - Setup Telegram and YooKassa webhooks"
	@echo "  make scale-workers N=<num> - Scale worker replicas"

install:
	pnpm install

build:
	pnpm build

dev:
	pnpm dev

clean:
	pnpm clean

lint:
	pnpm lint

typecheck:
	pnpm typecheck

test:
	pnpm test

# Docker commands
docker-build:
	@echo "🐳 Building Docker images..."
	docker compose -f docker-compose.yml build

docker-up:
	@echo "🐳 Starting services with Docker Compose..."
	docker compose -f docker-compose.yml up -d
	@echo "✅ Services started!"

docker-down:
	@echo "🐳 Stopping services..."
	docker compose -f docker-compose.yml down

docker-deploy:
	@echo "🚀 Deploying with Docker Compose (production)..."
	./scripts/deploy/docker-deploy.sh

docker-logs:
	docker compose -f docker-compose.yml logs -f

# Deployment commands
fly-deploy:
	@echo "🚀 Deploying to Fly.io..."
	./scripts/deploy/fly-deploy.sh

railway-deploy:
	@echo "🚀 Deploying to Railway..."
	./scripts/deploy/railway-deploy.sh

# Database commands
db-migrate:
	@echo "🔄 Running database migrations..."
	./scripts/db/migrate.sh

db-backup:
	@echo "💾 Backing up database..."
	./scripts/backup/backup-db.sh

db-restore:
	@if [ -z "$(FILE)" ]; then \
		echo "❌ Please specify backup file: make db-restore FILE=<backup.sql.gz>"; \
		exit 1; \
	fi
	@echo "📥 Restoring database from $(FILE)..."
	./scripts/backup/restore-db.sh $(FILE)

# Storage commands
storage-backup:
	@echo "☁️  Backing up storage..."
	./scripts/backup/backup-storage.sh

# Operations commands
setup-webhooks:
	@echo "🔧 Setting up webhooks..."
	./scripts/deploy/setup-webhooks.sh

scale-workers:
	@if [ -z "$(N)" ]; then \
		echo "❌ Please specify number of replicas: make scale-workers N=<num>"; \
		exit 1; \
	fi
	@echo "⚖️  Scaling workers to $(N) replicas..."
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale worker=$(N)
