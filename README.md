# Monorepo

[![CI](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/ci.yml)
[![Build & Deploy](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/build-deploy.yml/badge.svg)](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/build-deploy.yml)

A modern TypeScript monorepo powered by pnpm workspaces.

## 🏗️ Architecture

This monorepo consists of multiple services and shared packages organized using pnpm workspaces:

```
monorepo/
├── services/
│   ├── api/          # REST API service
│   ├── bot/          # Bot service
│   └── worker/       # Background worker service
├── packages/
│   ├── config/       # Shared configuration utilities
│   ├── database/     # Prisma ORM and database schema
│   ├── monitoring/   # Monitoring, logging, and analytics
│   ├── rate-limit/   # Rate limiting and token billing
│   ├── shared/       # Shared types, utilities, and business logic
│   └── test-utils/   # Testing utilities and mocks
```

## 📦 Services

### API (`services/api`)
The main REST API service responsible for handling HTTP requests and serving data to clients.

### Bot (`services/bot`)
A bot service for automated tasks, integrations, or chat functionality.

### Worker (`services/worker`)
A background worker service for processing asynchronous jobs, scheduled tasks, or queue-based operations.

## 📚 Packages

### Config (`packages/config`)
Centralized configuration management with dotenv-flow and zod validation:
- **dotenv-flow**: Automatic loading from multiple .env files
- **zod**: Runtime validation of required environment variables
- **Type Safety**: Full TypeScript support with inferred types
- **Service-Specific**: Separate config helpers for API, Bot, and Worker services
- **Error Handling**: Clear error messages for missing or invalid variables

See [Config Package](packages/config/README.md) for detailed documentation.

### Database (`packages/database`)
Prisma ORM layer for PostgreSQL with type-safe database access:
- **Prisma Client**: Type-safe database queries with auto-generated types
- **Migrations**: Version-controlled schema changes with migration files
- **Seeding**: Automated seed scripts for subscription tiers and test data
- **Models**: Users, Subscriptions, Generations, Payments, ChatMessages
- **Relations**: Properly defined foreign keys and cascading deletes

See [Database Package](packages/database/README.md) and [Migration Workflow](docs/PRISMA_MIGRATION_WORKFLOW.md) for details.

### Shared (`packages/shared`)
Common types, interfaces, utilities, and business logic shared between services.

### Monitoring (`packages/monitoring`)
Comprehensive monitoring, logging, and analytics package featuring:
- **Pino**: Structured JSON logging with pretty printing for development
- **Prometheus**: Metrics collection and KPI tracking
- **Sentry**: Error tracking and performance monitoring
- **Alerting**: Built-in alert system for critical events

See [Monitoring Guide](docs/MONITORING.md) and [KPI Tracking Guide](docs/KPI_TRACKING.md) for details.

### Rate Limit (`packages/rate-limit`)
Redis-based rate limiting and token billing system:
- **Rate Limiting**: Sliding window + token bucket for anti-abuse
- **Token Billing**: Token deduction and balance management
- **User Caching**: Efficient caching with TTL and invalidation
- **Subscription Tiers**: Gift (100 tokens), Professional (2000 tokens), Business (10000 tokens)

See [Rate Limiting Guide](docs/RATE_LIMITING_AND_TOKEN_BILLING.md) for details.

### Test Utils (`packages/test-utils`)
Testing utilities and mocks for all services:
- **Mocks**: Telegram Bot, OpenAI, Anthropic, Redis, PostgreSQL, S3
- **Helpers**: waitFor, mockConsole, mockDateNow, createMockEnv
- **Coverage**: Comprehensive test coverage with Jest

## 🛠️ Tech Stack

- **Language:** TypeScript
- **Package Manager:** pnpm (with workspaces)
- **Runtime:** Node.js (>=18.0.0)
- **Linting:** ESLint with TypeScript support
- **Formatting:** Prettier
- **Build Tool:** TypeScript Compiler (tsc)
- **Monitoring:** Pino, Prometheus, Sentry
- **Metrics:** Prometheus with Grafana dashboards
- **Error Tracking:** Sentry

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

Install pnpm if you don't have it:
```bash
npm install -g pnpm
```

### Installation

Install all dependencies across the monorepo:

```bash
pnpm install
```

### Configuration

Copy the `.env.example` file to `.env` and configure the environment variables:

```bash
cp .env.example .env
```

Edit `.env` with your configuration values. See [Environment Variables](#-environment-variables) section for details.

The config package uses `dotenv-flow` which supports multiple environment files:
- `.env` - Base configuration (committed)
- `.env.local` - Local overrides (gitignored)
- `.env.development` - Development-specific config
- `.env.production` - Production-specific config
- `.env.test` - Test-specific config

For detailed configuration documentation, see [Config Package](packages/config/README.md).

### Database Setup

1. **Start PostgreSQL:**
   ```bash
   docker compose up -d postgres
   ```

2. **Generate Prisma Client:**
   ```bash
   pnpm db:generate
   ```

3. **Apply migrations:**
   ```bash
   pnpm db:migrate:deploy
   ```

4. **Seed the database:**
   ```bash
   pnpm db:seed
   ```

For detailed database documentation, see:
- [Database Package](packages/database/README.md)
- [Migration Workflow](docs/PRISMA_MIGRATION_WORKFLOW.md)

## 🐳 Docker

This project includes a complete Docker setup with multi-stage builds and docker-compose orchestration for both development and production environments.

### Stack Components

- **PostgreSQL 15** - Primary database with automatic initialization
- **Redis 7** - Caching and queue management
- **MinIO** - S3-compatible object storage (local Backblaze B2 stand-in)
- **API Service** - REST API (Node.js)
- **Bot Service** - Telegram bot (Node.js)
- **Worker Service** - Background job processor (Node.js)

### Quick Start with Docker

#### Production Mode

```bash
# Build and start all services
docker compose up -d

# View logs
docker compose logs -f

# Check service status
docker compose ps
```

#### Development Mode

For development with hot-reload and volume mounting:

```bash
# Start with development overrides
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# View logs for specific service
docker compose logs -f api

# Rebuild after dependency changes
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

### Container Workflows

#### Initial Setup

1. **Clone and configure environment:**
   ```bash
   git clone <repository>
   cd monorepo
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Start infrastructure services:**
   ```bash
   # Start PostgreSQL, Redis, and MinIO
   docker compose up -d postgres redis minio
   
   # Wait for services to be healthy
   docker compose ps
   ```

3. **Run database migrations:**
   ```bash
   # Generate Prisma Client
   docker compose exec api pnpm db:generate
   
   # Apply migrations
   docker compose exec api pnpm db:migrate:deploy
   
   # Seed database with initial data
   docker compose exec api pnpm db:seed
   ```

4. **Start application services:**
   ```bash
   docker compose up -d api bot worker
   ```

#### Building Images

```bash
# Build all services
docker compose build

# Build specific service
docker compose build api

# Build with no cache
docker compose build --no-cache

# Build for production
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
```

#### Running Migrations

```bash
# Run migrations in running container
docker compose exec api pnpm db:migrate:deploy

# Run migrations during startup (add to docker-compose.yml)
# See services/api/entrypoint.sh for example

# Create a new migration
docker compose exec api pnpm db:migrate:dev --name your_migration_name

# Reset database (destructive)
docker compose exec api pnpm db:migrate:reset
```

#### Database Management

```bash
# Open Prisma Studio
docker compose exec api pnpm db:studio
# Access at http://localhost:5555

# Backup database
docker compose exec postgres pg_dump -U postgres monorepo > backup.sql

# Restore database
docker compose exec -T postgres psql -U postgres monorepo < backup.sql

# Access PostgreSQL shell
docker compose exec postgres psql -U postgres monorepo
```

#### MinIO (S3 Storage)

MinIO provides local S3-compatible object storage for development:

```bash
# Access MinIO Console
# http://localhost:9001
# Default credentials: minioadmin / minioadmin

# The bucket is automatically created on startup via minio-setup service
# Configure S3 endpoint in .env:
# S3_ENDPOINT=http://minio:9000
# S3_BUCKET=monorepo
# S3_ACCESS_KEY_ID=minioadmin
# S3_SECRET_ACCESS_KEY=minioadmin123
```

#### Logs and Debugging

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f api
docker compose logs -f bot
docker compose logs -f worker

# View last 100 lines
docker compose logs --tail=100 api

# Execute commands in running container
docker compose exec api sh
docker compose exec api pnpm typecheck
docker compose exec api pnpm test
```

#### Stopping and Cleaning

```bash
# Stop all services
docker compose down

# Stop and remove volumes (destructive)
docker compose down -v

# Stop and remove images
docker compose down --rmi all

# Clean up everything
docker compose down -v --rmi all --remove-orphans
```

### Docker Compose Files

- **`docker-compose.yml`** - Base configuration with all services
- **`docker-compose.dev.yml`** - Development overrides (hot-reload, volume mounting)
- **`docker-compose.prod.yml`** - Production overrides (resource limits, scaling)
- **`docker-compose.monitoring.yml`** - Monitoring stack (Prometheus, Grafana, Alertmanager)
- **`docker-compose.nginx.yml`** - Nginx reverse proxy

### Multi-Stage Dockerfiles

Each service uses optimized multi-stage builds:

1. **Base** - Install pnpm
2. **Dependencies** - Install all dependencies
3. **Build** - Build TypeScript to JavaScript
4. **Production** - Minimal runtime image with only production dependencies

Benefits:
- Smaller final images
- Faster builds with layer caching
- Separate dev and prod dependencies

### Environment Variables

Docker services use environment variables from `.env` file:

```bash
# Copy example and customize
cp .env.example .env

# Key variables for Docker:
NODE_ENV=production
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=monorepo
REDIS_URL=redis://redis:6379
S3_ENDPOINT=http://minio:9000
S3_BUCKET=monorepo
```

### Scaling Services

```bash
# Scale workers
docker compose up -d --scale worker=3

# Or set in .env
WORKER_REPLICAS=3
docker compose up -d

# Scale API
API_REPLICAS=2
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Production Deployment

```bash
# Build for production
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start with production settings
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Enable monitoring
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

### Health Checks

All services include health checks:

- **PostgreSQL**: `pg_isready`
- **Redis**: `redis-cli ping`
- **MinIO**: HTTP endpoint check
- **API**: HTTP `/health` endpoint
- **Services**: Depend on healthy database and cache

### Troubleshooting

**Container won't start:**
```bash
# Check logs
docker compose logs service-name

# Check container status
docker compose ps

# Verify environment variables
docker compose config
```

**Database connection issues:**
```bash
# Verify PostgreSQL is healthy
docker compose ps postgres

# Check connection from container
docker compose exec api sh
nc -zv postgres 5432
```

**Permission issues:**
```bash
# Fix storage permissions
docker compose exec api chown -R node:node /var/www/storage
```

**Out of disk space:**
```bash
# Clean up Docker resources
docker system prune -a --volumes
```

### Additional Docker Documentation

For more detailed Docker information, see:

- **[DOCKER.md](DOCKER.md)** - Comprehensive Docker setup guide with detailed instructions
- **[DOCKER_QUICK_REFERENCE.md](DOCKER_QUICK_REFERENCE.md)** - Quick reference for common Docker commands
- **[DOCKER_SETUP_SUMMARY.md](DOCKER_SETUP_SUMMARY.md)** - Implementation summary and architecture overview

## 🚢 Deployment

This project supports multiple deployment platforms:

- **Docker Compose**: Self-hosted deployment with full control
- **Fly.io**: Global distribution with automatic scaling
- **Railway**: Simple deployment with managed services

### Quick Deploy

```bash
# Docker Compose (self-hosted)
make docker-deploy

# Fly.io
make fly-deploy

# Railway
make railway-deploy
```

For detailed deployment instructions, see:
- [Quickstart Guide](docs/QUICKSTART.md) - Get deployed in 5 minutes
- [Deployment Guide](docs/DEPLOYMENT.md) - Comprehensive deployment documentation

## 🔄 CI/CD

This project uses GitHub Actions for continuous integration and deployment.

### Workflows

- **CI Pipeline**: Runs on every push to `main` and on pull requests
  - Linting with ESLint
  - Type checking with TypeScript
  - Building all packages and services
  - Running tests
  - Caching pnpm store for faster builds

- **Build & Deploy Pipeline**: Runs on push to `main` or version tags
  - Builds Docker images for all services (api, bot, worker)
  - Pushes images to GitHub Container Registry
  - Runs database migrations
  - Deploys services to production

### Docker Images

Docker images are automatically built and pushed to GitHub Container Registry (GHCR) with the following tags:
- `latest` - Latest build from main branch
- `main-<sha>` - Specific commit from main branch
- `v1.2.3` - Semantic version tags
- `1.2` - Major.minor version tags
- `1` - Major version tags

### Required Secrets

Configure the following secrets in your GitHub repository settings (Settings → Secrets and variables → Actions):

#### Required for Migrations & Deployment

- `DATABASE_URL`: PostgreSQL connection string for running migrations
  - Format: `postgresql://user:password@host:port/database`
  - Example: `postgresql://postgres:secure_password@db.example.com:5432/production_db`

#### Optional for Custom Deployment

- `DEPLOY_KEY`: SSH private key for deployment server access
- `DEPLOY_HOST`: Hostname or IP of the deployment server
- `DEPLOY_USER`: Username for SSH connection

#### Built-in Secrets (automatically available)

- `GITHUB_TOKEN`: Automatically provided by GitHub Actions for pushing Docker images to GHCR

### Caching Strategy

The CI/CD pipelines use multiple caching strategies for optimal performance:

1. **pnpm Store Cache**: Caches the global pnpm store to speed up dependency installation
   - Key: `${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}`
   - Invalidated when `pnpm-lock.yaml` changes

2. **Prisma Client Cache**: Caches generated Prisma clients (if Prisma is used)
   - Key: `${{ runner.os }}-prisma-${{ hashFiles('**/schema.prisma') }}`
   - Invalidated when Prisma schema files change
   - Significantly reduces CI time by avoiding regenerating Prisma clients

3. **Docker Build Cache**: Uses GitHub Actions cache for Docker layer caching
   - Significantly speeds up Docker image builds
   - Automatically managed by Docker Buildx

### Setting Up CI/CD

1. **Enable GitHub Actions**: Actions are enabled by default in most repositories

2. **Configure Secrets**:
   ```bash
   # Go to your repository on GitHub
   # Navigate to Settings → Secrets and variables → Actions
   # Click "New repository secret" for each required secret
   ```

3. **Update Badge URLs**: Replace `YOUR_USERNAME/YOUR_REPO` in README badges with your actual GitHub repository path

4. **First Run**: Push to `main` branch or create a pull request to trigger the workflows

### Development

Run all services in development mode:
```bash
pnpm dev
```

Run a specific service:
```bash
pnpm api:dev      # Run API service
pnpm bot:dev      # Run bot service
pnpm worker:dev   # Run worker service
```

### Building

Build all packages and services:
```bash
pnpm build
```

### Linting

Lint all packages and services:
```bash
pnpm lint
```

### Type Checking

Run TypeScript type checking across the monorepo:
```bash
pnpm typecheck
```

### Testing

Run tests across all packages and services:
```bash
pnpm test              # Run all tests
pnpm test:watch        # Run tests in watch mode
pnpm test:coverage     # Run tests with coverage report
pnpm test:ci           # Run tests optimized for CI
```

Or use Make commands:
```bash
make test              # Run all tests
make test-watch        # Run tests in watch mode
make test-coverage     # Run tests with coverage
make test-docker       # Run tests in Docker environment
```

For detailed testing documentation, see [Testing Guide](docs/TESTING.md).

### Database Commands

Manage database schema and migrations:
```bash
pnpm db:generate          # Generate Prisma Client
pnpm db:migrate:dev       # Create and apply new migration
pnpm db:migrate:deploy    # Apply pending migrations (production)
pnpm db:migrate:reset     # Reset database and run seed
pnpm db:seed              # Seed database with test data
pnpm db:studio            # Open Prisma Studio (database UI)
```

For detailed database documentation, see [Migration Workflow](docs/PRISMA_MIGRATION_WORKFLOW.md).

### Cleaning

Clean build artifacts:
```bash
pnpm clean
```

## 📊 Monitoring & Analytics

This monorepo includes comprehensive monitoring and analytics capabilities:

### Quick Start

1. **Enable metrics** in your `.env`:
   ```bash
   ENABLE_METRICS=true
   METRICS_PORT=9091
   LOG_LEVEL=info
   ```

2. **Access metrics**:
   - Metrics: http://localhost:9091/metrics
   - Health: http://localhost:9091/health

3. **Start monitoring stack** (optional):
   ```bash
   docker-compose -f docker-compose.monitoring.yml up -d
   ```
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3001 (admin/admin)
   - AlertManager: http://localhost:9093

### Key Performance Indicators (KPIs)

The system tracks:
- **Active Users**: Real-time user activity
- **Generation Success/Failure**: AI content generation metrics
- **Token Spend**: AI API cost tracking
- **Payment Conversions**: Revenue and payment metrics
- **Queue Performance**: Background job processing
- **HTTP Performance**: API response times and errors

### Documentation

- [Monitoring Setup Guide](docs/MONITORING.md) - Complete setup instructions
- [KPI Tracking Guide](docs/KPI_TRACKING.md) - How to track business metrics
- [Analytics Queries](packages/monitoring/ANALYTICS.md) - Prometheus queries and dashboards

### Example Usage

```typescript
import { Monitoring } from '@monorepo/monitoring';

const monitoring = new Monitoring({ service: 'api' });

// Start metrics server
await monitoring.startMetricsServer();

// Track KPIs
monitoring.trackKPI({
  type: 'active_user',
  data: { userId: 'user-123' },
});

monitoring.trackKPI({
  type: 'generation_success',
  data: { type: 'image' },
});

// Handle errors
try {
  await processJob();
} catch (error) {
  monitoring.handleError(error, { context: 'job-processing' });
}
```

## 📝 Contribution Workflow

### 1. Branch Naming Convention

- **Feature:** `feature/description`
- **Bug Fix:** `fix/description`
- **Chore:** `chore/description`
- **Docs:** `docs/description`

### 2. Making Changes

1. Create a new branch from `main`:
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. Make your changes in the appropriate workspace(s)

3. Ensure your code passes all checks:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm build
   pnpm test
   ```

### 3. Code Style

- Follow the existing code style
- Use TypeScript strict mode
- Write meaningful commit messages
- Keep functions small and focused
- Add types for all function parameters and return values

### 4. Adding Dependencies

Add a dependency to a specific workspace:
```bash
# For a service
pnpm --filter api add <package-name>

# For a shared package
pnpm --filter @monorepo/shared add <package-name>

# For root (dev dependencies)
pnpm add -w -D <package-name>
```

### 5. Creating New Workspaces

When creating a new workspace:

1. Add the workspace directory to `pnpm-workspace.yaml` (if needed)
2. Create a `package.json` with appropriate scripts
3. Create a `tsconfig.json` extending the root configuration
4. Add a `src/` directory with an `index.ts` entry point
5. If it depends on other workspaces, use `workspace:*` protocol

### 6. Submitting Changes

1. Commit your changes:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

2. Push your branch:
   ```bash
   git push origin feature/my-new-feature
   ```

3. Create a pull request for review

## 🔧 Workspace Configuration

### Adding Workspace Dependencies

To use one workspace in another, add it as a dependency using the `workspace:*` protocol:

```json
{
  "dependencies": {
    "@monorepo/shared": "workspace:*"
  }
}
```

### Filtering Commands

Run commands on specific workspaces:

```bash
# Run command in a specific workspace
pnpm --filter <workspace-name> <command>

# Run command in multiple workspaces
pnpm --filter "@monorepo/*" <command>

# Run command in all services
pnpm --filter "./services/*" <command>
```

## 🔧 Environment Variables

The monorepo uses the `@monorepo/config` package for centralized configuration management with environment variables validation.

### Required Variables by Service

#### API Service
- `JWT_SECRET` - JWT secret key for authentication (required)
- `POSTGRES_*` or `DATABASE_URL` - Database connection

#### Bot Service
- `TELEGRAM_BOT_TOKEN` - Telegram bot token (required)
- `POSTGRES_*` or `DATABASE_URL` - Database connection
- `YOOKASSA_*` - YooKassa payment configuration (optional)

#### Worker Service
- `STORAGE_TYPE` - Storage backend: `local` or `s3`
- `S3_*` - S3 configuration if using S3 storage

### Common Variables (All Services)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NODE_ENV` | string | `development` | Node environment |
| `PORT` | number | `3000` | Service port |
| `LOG_LEVEL` | string | `info` | Logging level |
| `ENABLE_METRICS` | boolean | `false` | Enable Prometheus metrics |
| `METRICS_PORT` | number | `9091` | Metrics server port |
| `REDIS_HOST` | string | `localhost` | Redis host |
| `REDIS_PORT` | number | `6379` | Redis port |
| `REDIS_PASSWORD` | string | - | Redis password |
| `REDIS_URL` | string | - | Redis URL (overrides individual components) |

### Database Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `POSTGRES_HOST` | string | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | number | `5432` | PostgreSQL port |
| `POSTGRES_DB` | string | `monorepo` | Database name |
| `POSTGRES_USER` | string | `postgres` | Database user |
| `POSTGRES_PASSWORD` | string | `postgres` | Database password |
| `DATABASE_URL` | string | - | Full database URL (overrides individual components) |

### Storage Variables (Worker Service)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `STORAGE_TYPE` | string | `local` | Storage backend (`local` or `s3`) |
| `STORAGE_BASE_URL` | string | `http://localhost/static` | Base URL for static files |
| `STORAGE_LOCAL_PATH` | string | `/var/www/storage` | Local storage path |
| `S3_ENDPOINT` | string | - | S3 endpoint (for MinIO, Wasabi, etc.) |
| `S3_REGION` | string | `us-east-1` | AWS region |
| `S3_BUCKET` | string | - | S3 bucket name |
| `S3_ACCESS_KEY_ID` | string | - | AWS access key |
| `S3_SECRET_ACCESS_KEY` | string | - | AWS secret key |

### Monitoring Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `SENTRY_ENABLED` | boolean | `false` | Enable Sentry error tracking |
| `SENTRY_DSN` | string | - | Sentry DSN URL |
| `SENTRY_TRACES_SAMPLE_RATE` | number | `1.0` | Sentry traces sample rate |
| `SENTRY_PROFILES_SAMPLE_RATE` | number | `1.0` | Sentry profiles sample rate |
| `ALERT_WEBHOOK_URL` | string | - | Webhook URL for alerts (e.g., Slack) |

### Payment Variables (Bot Service)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `YOOKASSA_SHOP_ID` | string | - | YooKassa shop ID |
| `YOOKASSA_SECRET_KEY` | string | - | YooKassa secret key |
| `YOOKASSA_WEBHOOK_URL` | string | - | YooKassa webhook URL |
| `YOOKASSA_WEBHOOK_SECRET` | string | - | YooKassa webhook secret |

### Telegram Variables (Bot Service)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | string | **REQUIRED** | Telegram bot token |
| `TELEGRAM_WEBHOOK_DOMAIN` | string | - | Webhook domain |
| `TELEGRAM_WEBHOOK_PATH` | string | `/webhook/telegram` | Webhook path |
| `TELEGRAM_WEBHOOK_URL` | string | - | Full webhook URL |
| `TELEGRAM_WEBHOOK_SECRET` | string | - | Webhook secret for validation |

For complete environment variable documentation, see [Config Package](packages/config/README.md).

## 📂 Project Structure

```
.
├── .editorconfig              # Editor configuration
├── .eslintrc.json            # ESLint configuration
├── .gitignore                # Git ignore rules
├── .prettierrc.json          # Prettier configuration
├── package.json              # Root package.json with workspace scripts
├── pnpm-workspace.yaml       # pnpm workspace configuration
├── tsconfig.json             # Root TypeScript configuration
├── README.md                 # This file
├── packages/
│   ├── config/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts
│   └── shared/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts
└── services/
    ├── api/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       └── index.ts
    ├── bot/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       └── index.ts
    └── worker/
        ├── package.json
        ├── tsconfig.json
        └── src/
            └── index.ts
```

## 📄 License

This project is private and proprietary.
