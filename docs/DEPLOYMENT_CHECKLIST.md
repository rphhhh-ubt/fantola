# Production Deployment Checklist

Use this checklist before deploying to production to ensure everything is properly configured.

## Pre-Deployment Checklist

### 1. Environment Configuration

- [ ] Copy `.env.example` to `.env`
- [ ] Set `NODE_ENV=production`
- [ ] Configure database credentials (`DATABASE_URL`, `POSTGRES_*`)
- [ ] Configure Redis credentials (`REDIS_URL`, `REDIS_PASSWORD`)
- [ ] Set strong `JWT_SECRET` (minimum 32 characters)
- [ ] Configure Telegram bot (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_DOMAIN`)
- [ ] Configure YooKassa (`YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`)
- [ ] Configure S3/storage (`S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`)
- [ ] Set backup configuration (`S3_BACKUP_BUCKET`)
- [ ] Configure worker settings (`WORKER_CONCURRENCY`, `WORKER_REPLICAS`)

### 2. Security

- [ ] Change all default passwords
- [ ] Use strong, unique passwords (minimum 16 characters)
- [ ] Enable HTTPS/TLS (automatic on Fly.io/Railway, configure for Docker)
- [ ] Configure webhook secrets (`TELEGRAM_WEBHOOK_SECRET`, `YOOKASSA_WEBHOOK_SECRET`)
- [ ] Review and restrict database user permissions
- [ ] Set up firewall rules (if self-hosted)
- [ ] Enable database connection encryption
- [ ] Configure rate limiting (nginx config included)
- [ ] Review CORS settings
- [ ] Disable debug mode and verbose logging

### 3. Infrastructure

- [ ] Choose deployment platform (Docker/Fly.io/Railway)
- [ ] Provision PostgreSQL database
- [ ] Provision Redis instance
- [ ] Configure S3 or object storage
- [ ] Set up SSL certificates (if self-hosted)
- [ ] Configure DNS records
- [ ] Set up CDN (optional)

### 4. Code Preparation

- [ ] Run tests: `make test`
- [ ] Run linting: `make lint`
- [ ] Run type checking: `make typecheck`
- [ ] Build all services: `make build`
- [ ] Review and merge all pending changes
- [ ] Tag release version
- [ ] Update CHANGELOG (if applicable)

## Deployment Checklist

### 5. Initial Deployment

- [ ] Deploy infrastructure (database, Redis, storage)
- [ ] Deploy application services
  - [ ] API service
  - [ ] Bot service
  - [ ] Worker service
- [ ] Run database migrations: `make db-migrate`
- [ ] Verify database schema
- [ ] Setup webhooks: `make setup-webhooks`
- [ ] Verify webhook configuration

### 6. Service Configuration

- [ ] Configure API replicas (recommended: 2+)
- [ ] Configure worker replicas (recommended: 3+)
- [ ] Set worker concurrency based on load
- [ ] Configure connection pools (database, Redis)
- [ ] Set up health check endpoints
- [ ] Configure log levels

### 7. Verification

- [ ] Run health checks: `./scripts/monitoring/health-check.sh`
- [ ] Test API endpoints
  - [ ] Health endpoint: `/health`
  - [ ] Key API routes
- [ ] Test Telegram bot
  - [ ] Send test message
  - [ ] Verify webhook receives updates
- [ ] Test YooKassa webhooks (if applicable)
- [ ] Verify worker processing
  - [ ] Check queue is processing jobs
  - [ ] Monitor worker logs
- [ ] Test database connectivity
- [ ] Test Redis connectivity
- [ ] Verify S3/storage access

### 8. Monitoring Setup

- [ ] Set up health check automation (cron or monitoring service)
- [ ] Configure log aggregation
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Configure uptime monitoring
- [ ] Set up alerts for:
  - [ ] Service downtime
  - [ ] High error rates
  - [ ] Database connection issues
  - [ ] Queue backup
  - [ ] Disk space
  - [ ] High CPU/memory usage

### 9. Backup Configuration

- [ ] Test database backup: `make db-backup`
- [ ] Verify backup file is created
- [ ] Test database restore procedure
- [ ] Configure automated daily backups
- [ ] Set up backup retention policy
- [ ] Configure storage backup
- [ ] Test storage restore procedure
- [ ] Verify backups are stored off-site

### 10. Documentation

- [ ] Document deployment configuration
- [ ] Update environment variables documentation
- [ ] Document custom configurations
- [ ] Create runbook for common operations
- [ ] Document incident response procedures
- [ ] Share credentials securely with team

## Post-Deployment Checklist

### 11. Immediate Post-Deployment (First Hour)

- [ ] Monitor logs for errors
  - [ ] API logs
  - [ ] Bot logs
  - [ ] Worker logs
- [ ] Monitor application metrics
  - [ ] Response times
  - [ ] Error rates
  - [ ] Request volume
- [ ] Check database performance
- [ ] Monitor queue lengths
- [ ] Verify webhooks are receiving events
- [ ] Test critical user flows

### 12. First 24 Hours

- [ ] Review error logs
- [ ] Check resource usage
  - [ ] CPU utilization
  - [ ] Memory usage
  - [ ] Disk space
- [ ] Monitor database connections
- [ ] Verify scheduled jobs are running
- [ ] Check backup completion
- [ ] Review performance metrics
- [ ] Collect user feedback (if applicable)

### 13. First Week

- [ ] Review all monitoring alerts
- [ ] Optimize resource allocation
- [ ] Tune worker scaling
- [ ] Optimize database queries
- [ ] Review and optimize logs
- [ ] Check backup integrity
- [ ] Performance tuning
- [ ] Security audit
- [ ] Update documentation based on learnings

## Platform-Specific Checklists

### Docker Compose Deployment

- [ ] Verify Docker and Docker Compose are installed
- [ ] Review `docker-compose.yml` and `docker-compose.prod.yml`
- [ ] Configure resource limits
- [ ] Set up log rotation
- [ ] Configure container restart policies
- [ ] Set up nginx reverse proxy (optional)
- [ ] Configure SSL certificates
- [ ] Set up firewall rules
- [ ] Test deployment: `make docker-deploy`

### Fly.io Deployment

- [ ] Install flyctl CLI
- [ ] Login: `flyctl auth login`
- [ ] Create apps for each service
- [ ] Create Postgres database: `flyctl postgres create`
- [ ] Create Redis: `flyctl redis create`
- [ ] Configure secrets for each app
- [ ] Review `deploy/fly/*.toml` files
- [ ] Deploy: `make fly-deploy`
- [ ] Configure custom domains (if needed)
- [ ] Set up CDN (automatic)

### Railway Deployment

- [ ] Install Railway CLI
- [ ] Login: `railway login`
- [ ] Create project
- [ ] Add PostgreSQL service
- [ ] Add Redis service
- [ ] Configure environment variables
- [ ] Review `deploy/railway/*.json` files
- [ ] Deploy: `make railway-deploy`
- [ ] Configure custom domains (if needed)

## Scaling Checklist

### When to Scale

Scale API when:

- [ ] Response times > 500ms
- [ ] CPU usage > 70%
- [ ] Memory usage > 80%

Scale Workers when:

- [ ] Queue length > 100 jobs
- [ ] Job processing time increases
- [ ] Worker CPU > 70%

### Scaling Actions

- [ ] Monitor current metrics
- [ ] Scale API: `docker compose up -d --scale api=N`
- [ ] Scale workers: `make scale-workers N=5`
- [ ] Verify new instances are healthy
- [ ] Monitor performance improvement
- [ ] Document scaling decision

## Rollback Checklist

If something goes wrong:

- [ ] Identify the issue
- [ ] Check logs for errors
- [ ] Attempt quick fix if obvious
- [ ] If fix fails, prepare for rollback
- [ ] Backup current database state
- [ ] Rollback application code
  - Docker: `git checkout <previous> && make docker-deploy`
  - Fly.io: `flyctl releases rollback <version> -a <app>`
  - Railway: Use dashboard to rollback
- [ ] Verify rollback successful
- [ ] Monitor for issues
- [ ] Document issue and resolution
- [ ] Plan fix for next deployment

## Emergency Contacts

Document key contacts:

- [ ] DevOps lead: **\*\***\_\_\_**\*\***
- [ ] Database admin: **\*\***\_\_\_**\*\***
- [ ] Security team: **\*\***\_\_\_**\*\***
- [ ] Platform support: **\*\***\_\_\_**\*\***

## Success Criteria

Deployment is successful when:

- [ ] All services are running and healthy
- [ ] Health checks pass
- [ ] No critical errors in logs
- [ ] Webhooks are receiving events
- [ ] Workers are processing jobs
- [ ] Database migrations completed
- [ ] Backups are configured and running
- [ ] Monitoring is active
- [ ] Team has been notified
- [ ] Documentation is updated

## Sign-Off

- [ ] Deployed by: **\*\***\_\_\_**\*\*** Date: **\*\***\_\_\_**\*\***
- [ ] Verified by: **\*\***\_\_\_**\*\*** Date: **\*\***\_\_\_**\*\***
- [ ] Security review: **\*\***\_\_\_**\*\*** Date: **\*\***\_\_\_**\*\***

---

**Remember:**

- Take your time with each step
- Don't skip security checks
- Always test in staging first
- Document everything
- Monitor closely after deployment

For detailed instructions, refer to:

- [Deployment Guide](DEPLOYMENT.md)
- [Operations Guide](OPERATIONS.md)
- [Quickstart Guide](QUICKSTART.md)
