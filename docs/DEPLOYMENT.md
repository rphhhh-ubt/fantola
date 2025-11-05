# Deployment Guide

This guide covers deployment procedures for the monorepo application across different platforms and environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Docker Compose Deployment](#docker-compose-deployment)
- [Fly.io Deployment](#flyio-deployment)
- [Railway Deployment](#railway-deployment)
- [Database Management](#database-management)
- [Webhook Setup](#webhook-setup)
- [Worker Scaling](#worker-scaling)
- [Backup and Restore](#backup-and-restore)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Docker** & **Docker Compose** (for Docker deployments)
- **PostgreSQL** client tools (for database operations)
- **AWS CLI** (for S3 storage operations)

### Platform-Specific Tools

- **Fly.io**: Install flyctl CLI

  ```bash
  curl -L https://fly.io/install.sh | sh
  ```

- **Railway**: Install Railway CLI
  ```bash
  npm install -g @railway/cli
  ```

## Environment Configuration

### 1. Create Environment File

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

### 2. Required Environment Variables

#### Database Configuration

```env
DATABASE_URL=postgresql://user:password@host:5432/database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=monorepo
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password
```

#### Redis Configuration

```env
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_redis_password
```

#### Telegram Bot

```env
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_DOMAIN=your-domain.com
TELEGRAM_WEBHOOK_PATH=/webhook/telegram
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
```

#### YooKassa Payment Gateway

```env
YOOKASSA_SHOP_ID=your_shop_id
YOOKASSA_SECRET_KEY=your_secret_key
YOOKASSA_WEBHOOK_URL=https://your-domain.com/webhook/yookassa
YOOKASSA_WEBHOOK_SECRET=your_webhook_secret
```

#### S3/Object Storage

```env
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=your-bucket-name
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
```

#### Worker Configuration

```env
WORKER_CONCURRENCY=10
WORKER_REPLICAS=3
```

## Docker Compose Deployment

Docker Compose is the recommended method for production deployments on your own infrastructure.

### Quick Start

```bash
# Deploy all services
make docker-deploy
```

### Manual Deployment Steps

#### 1. Build Images

```bash
make docker-build
# or
docker compose -f docker-compose.yml build
```

#### 2. Start Services

**Development:**

```bash
docker compose up -d
```

**Production:**

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

#### 3. Verify Deployment

```bash
# Check service status
docker compose ps

# View logs
docker compose logs -f

# Check specific service logs
docker compose logs -f api
docker compose logs -f worker
docker compose logs -f bot
```

#### 4. Run Database Migrations

```bash
make db-migrate
# or
docker compose exec api npm run migrate
```

#### 5. Setup Webhooks

```bash
make setup-webhooks
```

### Scaling Services

#### Scale API Service

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale api=3
```

#### Scale Workers

```bash
make scale-workers N=5
# or
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale worker=5
```

### Update Deployment

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Fly.io Deployment

Fly.io provides a distributed application platform with excellent global performance.

### Initial Setup

#### 1. Install and Login

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login
```

#### 2. Create Required Services

**PostgreSQL Database:**

```bash
flyctl postgres create --name monorepo-db --region iad
```

**Redis:**

```bash
flyctl redis create --name monorepo-redis --region iad
```

#### 3. Get Connection Strings

```bash
# Get PostgreSQL URL
flyctl postgres db list -a monorepo-db

# Get Redis URL
flyctl redis status -a monorepo-redis
```

### Deploy Services

#### Deploy All Services

```bash
make fly-deploy
# or
./scripts/deploy/fly-deploy.sh all
```

#### Deploy Specific Service

```bash
./scripts/deploy/fly-deploy.sh api
./scripts/deploy/fly-deploy.sh bot
./scripts/deploy/fly-deploy.sh worker
```

### Configure Secrets

```bash
# API Service
flyctl secrets set \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="redis://..." \
  YOOKASSA_SHOP_ID="..." \
  YOOKASSA_SECRET_KEY="..." \
  JWT_SECRET="..." \
  -a monorepo-api

# Bot Service
flyctl secrets set \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="redis://..." \
  TELEGRAM_BOT_TOKEN="..." \
  TELEGRAM_WEBHOOK_DOMAIN="monorepo-api.fly.dev" \
  -a monorepo-bot

# Worker Service
flyctl secrets set \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="redis://..." \
  S3_ACCESS_KEY_ID="..." \
  S3_SECRET_ACCESS_KEY="..." \
  -a monorepo-worker
```

### Scale Services

```bash
# Scale API replicas
flyctl scale count 2 -a monorepo-api

# Scale worker replicas
flyctl scale count 3 -a monorepo-worker

# Scale VM size
flyctl scale vm shared-cpu-2x -a monorepo-api
flyctl scale memory 1024 -a monorepo-api
```

### Run Migrations

```bash
# Connect to API machine and run migrations
flyctl ssh console -a monorepo-api -C "npm run migrate"
```

### Monitor Services

```bash
# View logs
flyctl logs -a monorepo-api
flyctl logs -a monorepo-bot
flyctl logs -a monorepo-worker

# Check status
flyctl status -a monorepo-api
```

## Railway Deployment

Railway provides a simple platform for deploying applications with automatic environments.

### Initial Setup

#### 1. Install and Login

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login
```

#### 2. Create Project

```bash
# Initialize project
railway init

# Link to existing project
railway link
```

#### 3. Add Services

Using Railway Dashboard:

1. Go to your project
2. Click "New Service"
3. Add PostgreSQL database
4. Add Redis
5. Deploy each service (api, bot, worker)

### Deploy Services

#### Deploy All Services

```bash
make railway-deploy
# or
./scripts/deploy/railway-deploy.sh all
```

#### Deploy Specific Service

```bash
./scripts/deploy/railway-deploy.sh api
./scripts/deploy/railway-deploy.sh bot
./scripts/deploy/railway-deploy.sh worker
```

### Configure Environment Variables

Via Railway Dashboard or CLI:

```bash
# Set variables
railway variables set DATABASE_URL="postgresql://..."
railway variables set REDIS_URL="redis://..."
railway variables set TELEGRAM_BOT_TOKEN="..."
railway variables set YOOKASSA_SHOP_ID="..."
railway variables set YOOKASSA_SECRET_KEY="..."
```

### Scale Services

```bash
# Scale via Railway Dashboard
# Or modify deploy/railway/railway.*.json files and redeploy
```

## Database Management

### Migrations

#### Create Migration

1. Create SQL file in `scripts/db/migrations/`
2. Name it with timestamp: `001_create_users_table.sql`

#### Run Migrations

```bash
make db-migrate
# or
./scripts/db/migrate.sh
```

#### Manual Migration (Docker)

```bash
docker compose exec postgres psql -U postgres -d monorepo -f /path/to/migration.sql
```

### Database Access

#### Local Access

```bash
psql postgresql://postgres:postgres@localhost:5432/monorepo
```

#### Docker Access

```bash
docker compose exec postgres psql -U postgres -d monorepo
```

#### Fly.io Access

```bash
flyctl postgres connect -a monorepo-db
```

## Webhook Setup

### Telegram Bot Webhook

#### Automatic Setup

```bash
make setup-webhooks
```

#### Manual Setup

```bash
# Set webhook
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-domain.com/webhook/telegram",
    "secret_token": "your_webhook_secret"
  }'

# Verify webhook
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

### YooKassa Webhook

Configure in YooKassa Dashboard:

1. Go to https://yookassa.ru/my/merchant/integration/http-notifications
2. Set webhook URL: `https://your-domain.com/webhook/yookassa`
3. Subscribe to events:
   - `payment.succeeded`
   - `payment.waiting_for_capture`
   - `payment.canceled`
   - `refund.succeeded`

## Worker Scaling

### Docker Compose

```bash
# Scale to 5 workers
make scale-workers N=5

# Or directly
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale worker=5
```

### Fly.io

```bash
flyctl scale count 5 -a monorepo-worker
```

### Railway

Modify `deploy/railway/railway.worker.json`:

```json
{
  "deploy": {
    "numReplicas": 5
  }
}
```

Then redeploy:

```bash
railway up --service worker
```

### Monitoring Worker Load

Monitor Redis queue length and worker performance to determine optimal scaling:

```bash
# Check Redis queue
redis-cli -h localhost -p 6379 LLEN jobs:pending

# Check worker logs
docker compose logs -f worker
```

## Backup and Restore

### Database Backup

#### Create Backup

```bash
make db-backup
# or
./scripts/backup/backup-db.sh
```

Backups are stored in `./backups/db/` and optionally uploaded to S3.

#### Restore Backup

```bash
make db-restore FILE=./backups/db/backup_20240101_120000.sql.gz
# or
./scripts/backup/restore-db.sh ./backups/db/backup_20240101_120000.sql.gz
```

#### Automated Backups

Setup a cron job for regular backups:

```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/project && ./scripts/backup/backup-db.sh
```

### Storage Backup

#### Create Backup

```bash
make storage-backup
# or
./scripts/backup/backup-storage.sh
```

This syncs your S3 bucket to a backup bucket.

### Backup Best Practices

1. **Regular Backups**: Schedule daily automated backups
2. **Off-site Storage**: Store backups in different regions/providers
3. **Test Restores**: Regularly test backup restoration
4. **Retention Policy**: Keep backups for at least 30 days
5. **Encryption**: Ensure backups are encrypted at rest

## Monitoring

### Health Checks

#### API Health

```bash
curl http://localhost:3000/health
```

#### Service Status

```bash
# Docker
docker compose ps

# Fly.io
flyctl status -a monorepo-api

# Railway
railway status
```

### Logs

#### Docker Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f worker
docker compose logs -f bot

# Last 100 lines
docker compose logs --tail=100 api
```

#### Fly.io Logs

```bash
flyctl logs -a monorepo-api
flyctl logs -a monorepo-bot -f
flyctl logs -a monorepo-worker --tail=100
```

#### Railway Logs

```bash
railway logs
railway logs --tail=100
```

### Metrics

Configure monitoring tools:

- **Prometheus**: Metrics collection
- **Grafana**: Metrics visualization
- **Sentry**: Error tracking
- **DataDog/New Relic**: APM

## Troubleshooting

### Common Issues

#### Services Won't Start

1. Check logs:

   ```bash
   docker compose logs
   ```

2. Verify environment variables:

   ```bash
   docker compose config
   ```

3. Check service health:
   ```bash
   docker compose ps
   ```

#### Database Connection Issues

1. Verify DATABASE_URL is correct
2. Check if PostgreSQL is running:

   ```bash
   docker compose ps postgres
   ```

3. Test connection:
   ```bash
   docker compose exec postgres pg_isready -U postgres
   ```

#### Webhook Not Working

1. Verify webhook URL is publicly accessible
2. Check webhook secret matches
3. Verify SSL certificate is valid
4. Check webhook logs in service

#### Worker Not Processing Jobs

1. Check Redis connection
2. Verify worker is running:

   ```bash
   docker compose ps worker
   ```

3. Check worker logs:

   ```bash
   docker compose logs worker
   ```

4. Verify jobs are in queue:
   ```bash
   redis-cli LLEN jobs:pending
   ```

### Debug Mode

Enable debug logging:

```bash
# Set in .env
LOG_LEVEL=debug

# Restart services
docker compose restart
```

### Getting Help

1. Check logs first
2. Review environment configuration
3. Verify all required services are running
4. Check network connectivity
5. Review platform-specific documentation:
   - [Fly.io Docs](https://fly.io/docs/)
   - [Railway Docs](https://docs.railway.app/)
   - [Docker Compose Docs](https://docs.docker.com/compose/)

## Security Checklist

Before going to production:

- [ ] Change all default passwords
- [ ] Use strong JWT_SECRET
- [ ] Enable HTTPS/TLS
- [ ] Configure firewall rules
- [ ] Set up regular backups
- [ ] Enable monitoring and alerts
- [ ] Review and restrict database permissions
- [ ] Secure webhook endpoints
- [ ] Implement rate limiting
- [ ] Set up log aggregation
- [ ] Configure secrets management
- [ ] Enable database encryption at rest
- [ ] Set up VPC/private networking

## Performance Optimization

### API Service

- Scale horizontally based on traffic
- Enable caching (Redis)
- Optimize database queries
- Use connection pooling

### Worker Service

- Scale based on queue length
- Optimize job processing
- Implement job prioritization
- Monitor memory usage

### Database

- Regular VACUUM operations
- Index optimization
- Connection pooling
- Read replicas for scaling

## Maintenance

### Regular Tasks

**Daily:**

- Monitor service health
- Check error logs
- Review queue lengths

**Weekly:**

- Review performance metrics
- Check disk space
- Verify backups

**Monthly:**

- Update dependencies
- Review security patches
- Test disaster recovery
- Optimize database

### Updates

```bash
# Pull latest changes
git pull origin main

# Install dependencies
pnpm install

# Build
pnpm build

# Redeploy
make docker-deploy
# or
make fly-deploy
# or
make railway-deploy
```

## Rollback Procedures

### Docker Compose

```bash
# Rollback to previous image
docker compose down
git checkout <previous-commit>
docker compose up -d --build
```

### Fly.io

```bash
# List releases
flyctl releases -a monorepo-api

# Rollback
flyctl releases rollback <version> -a monorepo-api
```

### Railway

Use Railway Dashboard to rollback to previous deployment.

---

For more information, refer to:

- [README.md](../README.md) - Project overview
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Development guide
- Platform documentation for detailed configuration options
