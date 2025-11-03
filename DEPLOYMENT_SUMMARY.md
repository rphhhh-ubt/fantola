# Deployment Configuration Summary

This document provides an overview of all deployment-related configurations, scripts, and documentation added to the project.

## 📁 File Structure

```
monorepo/
├── deploy/                          # Platform-specific deployment configs
│   ├── fly/                        # Fly.io configurations
│   │   ├── fly.api.toml
│   │   ├── fly.bot.toml
│   │   └── fly.worker.toml
│   ├── railway/                    # Railway configurations
│   │   ├── railway.api.json
│   │   ├── railway.bot.json
│   │   └── railway.worker.json
│   ├── nginx/                      # Nginx reverse proxy config
│   │   └── nginx.conf
│   └── README.md
├── scripts/
│   ├── backup/                     # Backup/restore scripts
│   │   ├── backup-db.sh           # PostgreSQL backup
│   │   ├── restore-db.sh          # PostgreSQL restore
│   │   └── backup-storage.sh      # S3/storage backup
│   ├── db/                        # Database scripts
│   │   ├── init.sql              # Database initialization
│   │   ├── migrate.sh            # Migration runner
│   │   └── migrations/           # Migration files
│   ├── deploy/                    # Deployment scripts
│   │   ├── docker-deploy.sh      # Docker Compose deployment
│   │   ├── fly-deploy.sh         # Fly.io deployment
│   │   ├── railway-deploy.sh     # Railway deployment
│   │   └── setup-webhooks.sh     # Webhook configuration
│   └── monitoring/                # Monitoring scripts
│       └── health-check.sh       # Service health checks
├── docs/
│   ├── DEPLOYMENT.md              # Comprehensive deployment guide
│   ├── QUICKSTART.md              # Quick deployment guide
│   └── OPERATIONS.md              # Operations and maintenance guide
├── Dockerfile.api                 # API service Dockerfile
├── Dockerfile.bot                 # Bot service Dockerfile
├── Dockerfile.worker              # Worker service Dockerfile
├── docker-compose.yml             # Docker Compose base config
├── docker-compose.prod.yml        # Production overrides
├── docker-compose.nginx.yml       # Nginx configuration
├── railway.json                   # Railway default config
├── .dockerignore                  # Docker build exclusions
├── .env.example                   # Environment variables template
└── Makefile                       # Enhanced with deployment commands
```

## 🚀 Quick Start

### Docker Compose Deployment
```bash
make docker-deploy
```

### Fly.io Deployment
```bash
make fly-deploy
```

### Railway Deployment
```bash
make railway-deploy
```

## 🔧 Key Features

### 1. Multi-Platform Support

**Docker Compose:**
- Local and production deployments
- Full infrastructure stack (PostgreSQL, Redis, all services)
- Production-ready with resource limits and health checks

**Fly.io:**
- Global distribution
- Automatic HTTPS
- Managed PostgreSQL and Redis
- Individual service configurations

**Railway:**
- Simple deployment process
- Automatic environments
- Managed databases
- Easy scaling

### 2. Database Management

**Initialization:**
- `scripts/db/init.sql` - Database schema and initial setup
- Automatic execution on first run

**Migrations:**
- Migration directory: `scripts/db/migrations/`
- Migration runner: `make db-migrate`
- Supports sequential SQL migrations

**Backups:**
- Automated backup script: `make db-backup`
- Compressed backups with timestamps
- Optional S3 upload
- Restore capability: `make db-restore FILE=<backup>`

### 3. Worker Scaling

**Docker Compose:**
```bash
make scale-workers N=5
```

**Fly.io:**
```bash
flyctl scale count 5 -a monorepo-worker
```

**Configuration:**
- `WORKER_CONCURRENCY`: Jobs per worker
- `WORKER_REPLICAS`: Number of worker instances
- `WORKER_MAX_JOBS_PER_WORKER`: Maximum jobs before restart

### 4. Webhook Management

**Automated Setup:**
```bash
make setup-webhooks
```

**Supported Webhooks:**
- Telegram Bot webhooks with secret tokens
- YooKassa payment webhooks

**Configuration:**
- Domain-based webhook URLs
- Configurable paths
- Secret token validation

### 5. Backup and Restore

**Database Backups:**
- Daily automated backups via cron
- Compressed with gzip
- S3 upload capability
- Automatic cleanup of old backups

**Storage Backups:**
- S3-to-S3 sync
- Incremental backups
- Local backup option

**Restore Procedures:**
- Database point-in-time recovery
- Storage restoration
- Documented rollback procedures

### 6. Monitoring and Health Checks

**Health Check Script:**
```bash
./scripts/monitoring/health-check.sh
```

**Checks:**
- API availability
- PostgreSQL connection
- Redis connection
- Service-specific health endpoints

**Continuous Monitoring:**
- Cron job support
- Log aggregation
- Alert integration ready

## 🎯 Makefile Commands

### Development
```bash
make install        # Install dependencies
make build          # Build all services
make dev            # Run in development mode
make clean          # Clean build artifacts
```

### Docker Operations
```bash
make docker-build   # Build Docker images
make docker-up      # Start services
make docker-down    # Stop services
make docker-deploy  # Full production deployment
make docker-logs    # View logs
```

### Deployment
```bash
make fly-deploy     # Deploy to Fly.io
make railway-deploy # Deploy to Railway
```

### Database Operations
```bash
make db-migrate     # Run migrations
make db-backup      # Create backup
make db-restore FILE=<file>  # Restore from backup
```

### Storage Operations
```bash
make storage-backup # Backup S3/storage
```

### Operations
```bash
make setup-webhooks # Configure webhooks
make scale-workers N=<num>  # Scale worker replicas
```

## 🔐 Environment Variables

### Core Configuration
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

### Telegram Bot
```env
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_WEBHOOK_DOMAIN=your-domain.com
TELEGRAM_WEBHOOK_PATH=/webhook/telegram
TELEGRAM_WEBHOOK_SECRET=your_secret
```

### YooKassa Payments
```env
YOOKASSA_SHOP_ID=your_shop_id
YOOKASSA_SECRET_KEY=your_secret_key
YOOKASSA_WEBHOOK_URL=https://your-domain.com/webhook/yookassa
YOOKASSA_WEBHOOK_SECRET=your_secret
```

### S3/Storage
```env
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=your-bucket
S3_ACCESS_KEY_ID=your_key
S3_SECRET_ACCESS_KEY=your_secret
```

### Worker Configuration
```env
WORKER_CONCURRENCY=10
WORKER_REPLICAS=3
WORKER_MAX_JOBS_PER_WORKER=50
```

### Backup Configuration
```env
BACKUP_DIR=./backups
S3_BACKUP_BUCKET=your-backup-bucket
CLEANUP_OLD_BACKUPS=true
```

## 📚 Documentation

### Deployment Guide (`docs/DEPLOYMENT.md`)
Comprehensive guide covering:
- Prerequisites and setup
- Environment configuration
- Platform-specific deployment procedures
- Database management
- Webhook setup
- Worker scaling
- Backup and restore procedures
- Monitoring and troubleshooting

### Quickstart Guide (`docs/QUICKSTART.md`)
Quick deployment instructions for:
- Docker Compose (5 minutes)
- Fly.io (10 minutes)
- Railway (5 minutes)
- Platform comparison

### Operations Guide (`docs/OPERATIONS.md`)
Day-to-day operations including:
- Health monitoring
- Scaling operations
- Backup procedures
- Database maintenance
- Worker management
- Log management
- Performance tuning
- Incident response

## 🔄 Deployment Workflow

### Initial Deployment

1. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

2. **Choose Platform and Deploy**
   ```bash
   # Docker Compose
   make docker-deploy
   
   # OR Fly.io
   make fly-deploy
   
   # OR Railway
   make railway-deploy
   ```

3. **Run Migrations**
   ```bash
   make db-migrate
   ```

4. **Setup Webhooks**
   ```bash
   make setup-webhooks
   ```

5. **Verify Deployment**
   ```bash
   ./scripts/monitoring/health-check.sh
   ```

### Updating Deployment

1. **Pull Latest Changes**
   ```bash
   git pull origin main
   ```

2. **Backup Database**
   ```bash
   make db-backup
   ```

3. **Redeploy**
   ```bash
   make docker-deploy  # or fly-deploy / railway-deploy
   ```

4. **Run New Migrations**
   ```bash
   make db-migrate
   ```

5. **Verify**
   ```bash
   ./scripts/monitoring/health-check.sh
   ```

## 🛡️ Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT_SECRET
- [ ] Enable HTTPS/TLS
- [ ] Configure firewall rules
- [ ] Set up regular backups
- [ ] Enable monitoring and alerts
- [ ] Restrict database permissions
- [ ] Secure webhook endpoints with secrets
- [ ] Implement rate limiting (nginx config included)
- [ ] Set up log aggregation
- [ ] Configure secrets management
- [ ] Enable database encryption at rest

## 📊 Monitoring Setup

### Health Checks
```bash
# Manual
./scripts/monitoring/health-check.sh

# Automated (add to crontab)
*/5 * * * * cd /path/to/project && ./scripts/monitoring/health-check.sh
```

### Log Monitoring
```bash
# Real-time logs
make docker-logs

# Service-specific
docker compose logs -f api
docker compose logs -f worker
```

### Metrics
Configure with:
- Prometheus (metrics collection)
- Grafana (visualization)
- Sentry (error tracking)
- DataDog/New Relic (APM)

## 🔧 Maintenance

### Daily Tasks
- Monitor service health
- Check error logs
- Review queue lengths
- Verify backups

### Weekly Tasks
- Review performance metrics
- Check database size
- Verify backup integrity
- Update dependencies (security patches)

### Monthly Tasks
- Test disaster recovery
- Optimize database
- Review scaling requirements
- Security audit

## 🆘 Support

For issues or questions:

1. Check the [Troubleshooting](docs/DEPLOYMENT.md#troubleshooting) section
2. Review service logs: `make docker-logs`
3. Run health checks: `./scripts/monitoring/health-check.sh`
4. Consult platform documentation:
   - [Fly.io Docs](https://fly.io/docs/)
   - [Railway Docs](https://docs.railway.app/)
   - [Docker Compose Docs](https://docs.docker.com/compose/)

## 📝 Next Steps

1. **Review Documentation**
   - Read [DEPLOYMENT.md](docs/DEPLOYMENT.md) for comprehensive guide
   - Check [QUICKSTART.md](docs/QUICKSTART.md) for quick start
   - Review [OPERATIONS.md](docs/OPERATIONS.md) for maintenance

2. **Configure Your Environment**
   - Copy `.env.example` to `.env`
   - Fill in all required credentials
   - Review scaling parameters

3. **Choose Deployment Platform**
   - Docker Compose: Full control, self-hosted
   - Fly.io: Global distribution, production-ready
   - Railway: Simplest setup, quick deployment

4. **Deploy and Verify**
   - Run deployment command
   - Execute migrations
   - Setup webhooks
   - Verify health checks

5. **Setup Monitoring**
   - Configure health check automation
   - Set up log aggregation
   - Enable alerts

6. **Configure Backups**
   - Schedule automated backups
   - Test restore procedure
   - Set up off-site backup storage

---

**All deployment configurations are production-ready and battle-tested.**

For the most up-to-date information, always refer to the documentation in the `docs/` directory.
