.PHONY: help install build dev clean lint typecheck test test-watch test-coverage test-ci test-docker
.PHONY: docker-build docker-up docker-dev docker-down docker-deploy docker-logs docker-up-nginx docker-ps docker-restart docker-clean
.PHONY: fly-deploy railway-deploy
.PHONY: db-migrate db-backup db-restore storage-backup storage-restore storage-clean storage-init
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
    @echo ""
    @echo "Testing:"
    @echo "  make test             - Run all tests"
    @echo "  make test-watch       - Run tests in watch mode"
    @echo "  make test-coverage    - Run tests with coverage report"
    @echo "  make test-ci          - Run tests optimized for CI"
    @echo "  make test-docker      - Run tests in Docker environment"
    @echo ""
    @echo "Docker Commands:"
    @echo "  make docker-build     - Build Docker images"
    @echo "  make docker-up        - Start services with Docker Compose (production)"
    @echo "  make docker-dev       - Start services in development mode"
    @echo "  make docker-up-nginx  - Start services with Nginx CDN"
    @echo "  make docker-down      - Stop services with Docker Compose"
    @echo "  make docker-deploy    - Deploy with Docker Compose (production)"
    @echo "  make docker-logs      - View Docker logs"
    @echo "  make docker-ps        - Show running containers"
    @echo "  make docker-clean     - Stop and remove all containers and volumes"
    @echo "  make docker-restart   - Restart all services"
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
    @echo "  make storage-init     - Initialize storage directories"
    @echo "  make storage-backup   - Backup storage volumes"
    @echo "  make storage-restore FILE=<backup.tar.gz> - Restore storage from backup"
    @echo "  make storage-clean    - Clean storage volumes"
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

test-watch:
    pnpm test:watch

test-coverage:
    pnpm test:coverage

test-ci:
    pnpm test:ci

test-docker:
    @echo "🧪 Running tests in Docker..."
    docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
    docker compose -f docker-compose.test.yml down -v

# Docker commands
docker-build:
    @echo "🐳 Building Docker images..."
    docker compose -f docker-compose.yml build

docker-up:
    @echo "🐳 Starting services with Docker Compose (production)..."
    docker compose -f docker-compose.yml up -d
    @echo "✅ Services started!"

docker-dev:
    @echo "🐳 Starting services in development mode..."
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
    @echo "✅ Development services started!"

docker-up-nginx:
    @echo "🐳 Starting services with Nginx CDN..."
    docker compose -f docker-compose.yml -f docker-compose.nginx.yml up -d
    @echo "✅ Services started with Nginx!"

docker-ps:
    @echo "📊 Running containers:"
    docker compose ps

docker-restart:
    @echo "🔄 Restarting all services..."
    docker compose restart
    @echo "✅ Services restarted!"

docker-clean:
    @echo "🧹 Cleaning up Docker resources..."
    docker compose down -v --rmi all --remove-orphans
    @echo "✅ Cleanup complete!"

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
storage-init:
    @echo "📁 Initializing storage directories..."
    @docker volume create monorepo_storage_uploads || true
    @docker volume create monorepo_storage_generated || true
    @docker volume create monorepo_storage_processed || true
    @echo "✅ Storage volumes created!"

storage-backup:
    @echo "☁️  Backing up storage volumes..."
    @mkdir -p ./backups/storage
    @docker run --rm \
        -v monorepo_storage_uploads:/uploads:ro \
        -v monorepo_storage_generated:/generated:ro \
        -v monorepo_storage_processed:/processed:ro \
        -v $(PWD)/backups/storage:/backup \
        alpine sh -c "tar czf /backup/storage-$(shell date +%Y%m%d-%H%M%S).tar.gz -C / uploads generated processed"
    @echo "✅ Storage backup completed!"

storage-restore:
    @if [ -z "$(FILE)" ]; then \
        echo "❌ Please specify backup file: make storage-restore FILE=<backup.tar.gz>"; \
        exit 1; \
    fi
    @echo "📥 Restoring storage from $(FILE)..."
    @docker run --rm \
        -v monorepo_storage_uploads:/uploads \
        -v monorepo_storage_generated:/generated \
        -v monorepo_storage_processed:/processed \
        -v $(PWD)/backups/storage:/backup:ro \
        alpine tar xzf /backup/$(notdir $(FILE)) -C /
    @echo "✅ Storage restored!"

storage-clean:
    @echo "🧹 Cleaning storage volumes..."
    @read -p "Are you sure you want to delete all storage data? [y/N] " -n 1 -r; \
    if [[ $REPLY =~ ^[Yy]$ ]]; then \
        docker volume rm monorepo_storage_uploads monorepo_storage_generated monorepo_storage_processed || true; \
        echo "\n✅ Storage volumes cleaned!"; \
    else \
        echo "\n❌ Cancelled"; \
    fi

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
