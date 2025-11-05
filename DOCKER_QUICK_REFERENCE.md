# Docker Quick Reference

Quick reference for common Docker commands and workflows.

## 🚀 Quick Start

```bash
# Clone and setup
git clone <repo>
cd monorepo
cp .env.example .env
# Edit .env with your credentials

# Start everything
docker compose up -d

# Initialize database
docker compose exec api pnpm db:generate
docker compose exec api pnpm db:migrate:deploy
docker compose exec api pnpm db:seed

# View logs
docker compose logs -f
```

## 📝 Common Commands

### Starting Services

```bash
# Production mode
docker compose up -d

# Development mode (hot-reload)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# With monitoring
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Rebuild and start
docker compose up -d --build
```

### Managing Services

```bash
# Stop services
docker compose down

# Restart services
docker compose restart

# Restart single service
docker compose restart api

# View status
docker compose ps

# View logs
docker compose logs -f api

# Scale workers
docker compose up -d --scale worker=3
```

### Building

```bash
# Build all images
docker compose build

# Build single service
docker compose build api

# Build without cache
docker compose build --no-cache
```

### Database Operations

```bash
# Generate Prisma Client
docker compose exec api pnpm db:generate

# Run migrations
docker compose exec api pnpm db:migrate:deploy

# Create migration
docker compose exec api pnpm db:migrate:dev --name add_feature

# Seed database
docker compose exec api pnpm db:seed

# Prisma Studio
docker compose exec api pnpm db:studio
# Open http://localhost:5555

# Backup database
docker compose exec postgres pg_dump -U postgres monorepo > backup.sql

# Restore database
docker compose exec -T postgres psql -U postgres monorepo < backup.sql

# Access PostgreSQL
docker compose exec postgres psql -U postgres monorepo
```

### Debugging

```bash
# View logs
docker compose logs -f api
docker compose logs --tail=100 worker
docker compose logs --since 1h bot

# Access shell
docker compose exec api sh
docker compose exec postgres sh

# Run commands
docker compose exec api pnpm test
docker compose exec api pnpm lint
docker compose exec api pnpm typecheck

# Check health
docker compose ps
curl http://localhost:3000/health

# Inspect container
docker inspect monorepo-api
docker stats
```

### Cleanup

```bash
# Stop services
docker compose down

# Stop and remove volumes
docker compose down -v

# Remove everything
docker compose down -v --rmi all --remove-orphans

# Clean Docker system
docker system prune -a --volumes
```

## 🔧 Makefile Commands

```bash
# Development
make docker-dev          # Start in development mode
make docker-up           # Start in production mode
make docker-build        # Build images
make docker-down         # Stop services

# Operations
make docker-ps           # Show containers
make docker-restart      # Restart services
make docker-logs         # View logs
make docker-clean        # Clean everything

# Database
make db-migrate          # Run migrations
make db-backup           # Backup database
make db-restore          # Restore database
```

## 🌐 Service Ports

| Service      | Port(s)      | Description                |
|--------------|--------------|----------------------------|
| API          | 3000         | REST API                   |
| PostgreSQL   | 5432         | Database                   |
| Redis        | 6379         | Cache & queues             |
| MinIO        | 9000, 9001   | S3 storage & console       |
| Prometheus   | 9090         | Metrics (optional)         |
| Grafana      | 3001         | Dashboards (optional)      |
| Alertmanager | 9093         | Alerts (optional)          |
| Prisma Studio| 5555         | DB GUI (when running)      |

## 📂 MinIO (S3 Storage)

```bash
# Access Console
# URL: http://localhost:9001
# Login: minioadmin / minioadmin123

# Configuration in .env
STORAGE_TYPE=s3
S3_ENDPOINT=http://minio:9000
S3_BUCKET=monorepo
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin123
```

## 🔒 Environment Variables

Required variables in `.env`:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/monorepo

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=your_secret_key

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token

# AI Providers
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key

# Storage (MinIO for dev)
S3_ENDPOINT=http://minio:9000
S3_BUCKET=monorepo
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin123
```

## 🐛 Troubleshooting

### Container won't start
```bash
docker compose logs service-name
docker compose ps
docker compose config
```

### Database connection failed
```bash
docker compose ps postgres
docker compose exec api nc -zv postgres 5432
```

### Out of disk space
```bash
docker system df
docker system prune -a --volumes
```

### Permission issues
```bash
docker compose exec api chown -R node:node /var/www/storage
```

### Reset everything
```bash
docker compose down -v --rmi all
docker volume prune -f
docker compose up -d --build
```

## 📖 More Documentation

- `README.md` - Complete README with Docker section
- `DOCKER.md` - Comprehensive Docker guide
- `DOCKER_SETUP_SUMMARY.md` - Implementation summary

## 💡 Tips

1. **Use development mode** for hot-reload during development
2. **Check logs** when something isn't working
3. **Use Prisma Studio** for easy database inspection
4. **Scale workers** based on queue size
5. **Monitor resources** with `docker stats`
6. **Clean regularly** to save disk space
7. **Use MinIO** for local S3 testing
8. **Set strong passwords** in production

## 🎯 Common Workflows

### Development

```bash
# Start development environment
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Make code changes (hot-reload)
# ... edit files ...

# Run tests
docker compose exec api pnpm test

# Check types
docker compose exec api pnpm typecheck

# View logs
docker compose logs -f api
```

### Production Deployment

```bash
# Build images
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Deploy
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Run migrations
docker compose exec api pnpm db:migrate:deploy

# Scale workers
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale worker=3

# Monitor
docker compose logs -f
docker stats
```

### Database Maintenance

```bash
# Backup
docker compose exec postgres pg_dump -U postgres monorepo > backup-$(date +%Y%m%d).sql
gzip backup-$(date +%Y%m%d).sql

# Restore
gunzip backup.sql.gz
docker compose exec -T postgres psql -U postgres monorepo < backup.sql

# Check connections
docker compose exec postgres psql -U postgres monorepo -c "SELECT count(*) FROM pg_stat_activity;"
```
