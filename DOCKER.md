# Docker Setup Guide

Complete guide for running the monorepo stack with Docker and docker-compose.

## Table of Contents

- [Overview](#overview)
- [Stack Components](#stack-components)
- [Quick Start](#quick-start)
- [Development Workflow](#development-workflow)
- [Production Deployment](#production-deployment)
- [Database Operations](#database-operations)
- [MinIO Storage](#minio-storage)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Overview

This project uses Docker for containerization with the following features:

- **Multi-stage builds** for optimized image sizes
- **Development and production** docker-compose configurations
- **Automatic database migrations** on startup
- **Health checks** for all services
- **MinIO** as local S3-compatible storage
- **Monitoring stack** with Prometheus and Grafana

## Stack Components

### Infrastructure

- **PostgreSQL 15** - Primary database with persistent volumes
- **Redis 7** - Caching, sessions, and BullMQ job queues
- **MinIO** - S3-compatible object storage for development

### Application Services

- **API Service** - Fastify REST API on port 3000
- **Bot Service** - Grammy Telegram bot
- **Worker Service** - BullMQ background job processor

### Monitoring (Optional)

- **Prometheus** - Metrics collection on port 9090
- **Grafana** - Visualization dashboards on port 3001
- **Alertmanager** - Alert routing on port 9093

## Quick Start

### 1. Environment Setup

```bash
# Clone repository
git clone <repository-url>
cd monorepo

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# At minimum, set:
# - TELEGRAM_BOT_TOKEN
# - GROQ_API_KEY
# - GEMINI_API_KEY
# - JWT_SECRET
nano .env
```

### 2. Start Infrastructure

```bash
# Start PostgreSQL, Redis, and MinIO
docker compose up -d postgres redis minio

# Wait for services to be healthy (check with docker compose ps)
docker compose ps

# Expected output:
# NAME                  STATUS         PORTS
# monorepo-postgres     Up (healthy)   0.0.0.0:5432->5432/tcp
# monorepo-redis        Up (healthy)   0.0.0.0:6379->6379/tcp
# monorepo-minio        Up (healthy)   0.0.0.0:9000-9001->9000-9001/tcp
```

### 3. Initialize Database

```bash
# Generate Prisma Client
docker compose run --rm api pnpm db:generate

# Run migrations
docker compose run --rm api pnpm db:migrate:deploy

# Seed database with initial data
docker compose run --rm api pnpm db:seed
```

### 4. Start Application Services

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Check status
docker compose ps
```

### 5. Verify Setup

```bash
# Check API health
curl http://localhost:3000/health

# Check MinIO console
# Open http://localhost:9001 in browser
# Login: minioadmin / minioadmin

# Check Prisma Studio
docker compose exec api pnpm db:studio
# Open http://localhost:5555 in browser
```

## Development Workflow

### Development Mode

Use `docker-compose.dev.yml` for development with hot-reload:

```bash
# Start in development mode
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# This will:
# - Mount source code as volumes for hot-reload
# - Use development environment variables
# - Enable debug logging
# - Connect to MinIO for local S3 storage
```

### Development Features

- **Hot Reload**: Code changes trigger automatic rebuild
- **Volume Mounting**: Source code mounted into containers
- **Debug Logging**: `LOG_LEVEL=debug` by default
- **MinIO**: Local S3-compatible storage at http://localhost:9000

### Building Images

```bash
# Build all services
docker compose build

# Build specific service
docker compose build api

# Build without cache
docker compose build --no-cache api

# Build for production
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
```

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f bot
docker compose logs -f worker

# Last 100 lines
docker compose logs --tail=100 api

# Since timestamp
docker compose logs --since 2024-01-01T00:00:00 api
```

### Running Commands

```bash
# Execute command in running container
docker compose exec api pnpm typecheck
docker compose exec api pnpm lint
docker compose exec api pnpm test

# Run command in new container
docker compose run --rm api pnpm db:migrate:dev --name new_migration

# Access shell
docker compose exec api sh
docker compose exec postgres psql -U postgres monorepo
```

## Production Deployment

### Production Configuration

Use `docker-compose.prod.yml` for production deployment:

```bash
# Build for production
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start production stack
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Production Features

- **Resource Limits**: CPU and memory constraints
- **Service Scaling**: Multiple API and Worker replicas
- **Restart Policies**: Automatic restart on failure
- **Redis Authentication**: Password-protected Redis
- **Optimized Images**: Minimal production images

### Scaling Services

```bash
# Scale workers to 3 replicas
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale worker=3

# Or set in .env
echo "WORKER_REPLICAS=3" >> .env
echo "API_REPLICAS=2" >> .env
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Environment Variables

Key production variables in `.env`:

```bash
NODE_ENV=production

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=monorepo
DATABASE_URL=postgresql://postgres:<strong-password>@postgres:5432/monorepo

# Redis
REDIS_PASSWORD=<redis-password>
REDIS_URL=redis://:redis-password@redis:6379

# JWT
JWT_SECRET=<random-secret-key>

# Telegram
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_WEBHOOK_DOMAIN=<your-domain.com>
TELEGRAM_WEBHOOK_SECRET=<webhook-secret>

# AI Providers
GROQ_API_KEY=<groq-api-key>
GEMINI_API_KEY=<gemini-api-key>

# Storage (S3 or MinIO)
STORAGE_TYPE=s3
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=<bucket-name>
S3_ACCESS_KEY_ID=<access-key>
S3_SECRET_ACCESS_KEY=<secret-key>

# Monitoring
SENTRY_ENABLED=true
SENTRY_DSN=<sentry-dsn>
```

## Database Operations

### Migrations

```bash
# Apply pending migrations
docker compose exec api pnpm db:migrate:deploy

# Create new migration
docker compose exec api pnpm db:migrate:dev --name add_user_settings

# Reset database (destructive)
docker compose exec api pnpm db:migrate:reset

# Generate Prisma Client
docker compose exec api pnpm db:generate
```

### Seeding

```bash
# Seed database
docker compose exec api pnpm db:seed

# Seeds:
# - Subscription tier configurations (Gift, Professional, Business)
# - Test users with tokens
```

### Backup and Restore

```bash
# Backup database
docker compose exec postgres pg_dump -U postgres monorepo > backup.sql

# Backup with timestamp
docker compose exec postgres pg_dump -U postgres monorepo > backup-$(date +%Y%m%d-%H%M%S).sql

# Restore database
docker compose exec -T postgres psql -U postgres monorepo < backup.sql

# Backup volumes
docker run --rm -v project_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres-backup.tar.gz -C /data .
```

### Prisma Studio

```bash
# Start Prisma Studio
docker compose exec api pnpm db:studio

# Access at http://localhost:5555
```

### Direct Database Access

```bash
# Access PostgreSQL shell
docker compose exec postgres psql -U postgres monorepo

# Run SQL query
docker compose exec postgres psql -U postgres monorepo -c "SELECT COUNT(*) FROM users;"

# Execute SQL file
docker compose exec -T postgres psql -U postgres monorepo < query.sql
```

## MinIO Storage

MinIO provides S3-compatible object storage for local development.

### Access MinIO Console

- **URL**: http://localhost:9001
- **Username**: minioadmin
- **Password**: minioadmin123

### MinIO API Endpoint

- **URL**: http://localhost:9000
- **Bucket**: monorepo (auto-created)

### Configuration

In `.env`:

```bash
# Use MinIO for development
STORAGE_TYPE=s3
S3_ENDPOINT=http://minio:9000
S3_REGION=us-east-1
S3_BUCKET=monorepo
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin123
```

### MinIO CLI

```bash
# Install MinIO client
docker run --rm -it --network project_default minio/mc alias set myminio http://minio:9000 minioadmin minioadmin123

# List buckets
docker run --rm -it --network project_default minio/mc ls myminio

# Upload file
docker run --rm -it --network project_default -v $(pwd):/data minio/mc cp /data/file.txt myminio/monorepo/

# Download file
docker run --rm -it --network project_default -v $(pwd):/data minio/mc cp myminio/monorepo/file.txt /data/
```

## Monitoring

### Start Monitoring Stack

```bash
# Start Prometheus, Grafana, and Alertmanager
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

### Access Monitoring Tools

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)
- **Alertmanager**: http://localhost:9093

### Available Dashboards

Grafana includes pre-configured dashboards for:

- System metrics (CPU, memory, disk)
- Application metrics (requests, errors, latency)
- Worker metrics (job processing, queues)
- Database metrics (connections, queries)

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs service-name

# Check container status
docker compose ps

# Verify configuration
docker compose config

# Rebuild container
docker compose up -d --build service-name
```

### Database Connection Issues

```bash
# Verify PostgreSQL is healthy
docker compose ps postgres

# Check connection
docker compose exec api sh
nc -zv postgres 5432

# Check DATABASE_URL
docker compose exec api env | grep DATABASE_URL
```

### Permission Issues

```bash
# Fix storage permissions
docker compose exec api chown -R node:node /var/www/storage
docker compose exec api chmod -R 755 /var/www/storage

# Check volume permissions
docker compose exec api ls -la /var/www/storage
```

### Out of Disk Space

```bash
# Check disk usage
docker system df

# Remove unused containers
docker container prune

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Clean everything (careful!)
docker system prune -a --volumes
```

### Service Not Responding

```bash
# Check health status
docker compose ps

# Restart service
docker compose restart api

# View recent logs
docker compose logs --tail=100 api

# Check resource usage
docker stats
```

### Network Issues

```bash
# Check network
docker network ls
docker network inspect project_default

# Restart networking
docker compose down
docker compose up -d

# Test connectivity between services
docker compose exec api ping postgres
docker compose exec api ping redis
docker compose exec api ping minio
```

### Reset Everything

```bash
# Stop and remove everything
docker compose down -v --rmi all --remove-orphans

# Remove volumes manually if needed
docker volume rm project_postgres_data
docker volume rm project_redis_data
docker volume rm project_minio_data

# Rebuild and restart
docker compose up -d --build
```

## Best Practices

### Development

1. Use `docker-compose.dev.yml` for development
2. Mount source code as volumes for hot-reload
3. Use MinIO for local S3 storage
4. Keep `.env.development` for local configuration

### Production

1. Use `docker-compose.prod.yml` for production
2. Set resource limits for all services
3. Use external S3 (Backblaze B2, AWS S3)
4. Enable monitoring with Prometheus/Grafana
5. Set up automated backups
6. Use strong passwords in `.env`
7. Enable Sentry for error tracking

### Security

1. Never commit `.env` files
2. Use secrets management in production
3. Enable Redis authentication
4. Use SSL/TLS for external connections
5. Regularly update base images
6. Run services as non-root user (already configured)

### Performance

1. Scale workers based on queue size
2. Monitor memory usage with `docker stats`
3. Use volume mounting only in development
4. Enable BuildKit for faster builds
5. Use multi-stage builds (already configured)

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [MinIO Documentation](https://min.io/docs/)
- [PostgreSQL Docker Documentation](https://hub.docker.com/_/postgres)
- [Redis Docker Documentation](https://hub.docker.com/_/redis)
