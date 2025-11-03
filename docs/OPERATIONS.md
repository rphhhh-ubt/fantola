# Operations Guide

This guide covers day-to-day operations, maintenance, and troubleshooting procedures.

## Table of Contents

- [Health Monitoring](#health-monitoring)
- [Scaling Operations](#scaling-operations)
- [Backup Operations](#backup-operations)
- [Database Operations](#database-operations)
- [Worker Management](#worker-management)
- [Webhook Management](#webhook-management)
- [Log Management](#log-management)
- [Performance Tuning](#performance-tuning)
- [Incident Response](#incident-response)

## Health Monitoring

### Manual Health Check

Run the health check script:

```bash
./scripts/monitoring/health-check.sh
```

This checks:
- API service availability
- PostgreSQL connection
- Redis connection

### Continuous Monitoring

Set up a cron job for regular health checks:

```bash
# Check every 5 minutes
*/5 * * * * cd /path/to/project && ./scripts/monitoring/health-check.sh >> /var/log/health-check.log 2>&1
```

### Service-Specific Health Endpoints

**API:**
```bash
curl http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

## Scaling Operations

### Scale API Service

**Docker Compose:**
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale api=3
```

**Fly.io:**
```bash
flyctl scale count 3 -a monorepo-api
flyctl scale vm shared-cpu-2x -a monorepo-api
flyctl scale memory 1024 -a monorepo-api
```

**Railway:**
Update `deploy/railway/railway.api.json` and redeploy.

### Scale Worker Service

**Quick Scale:**
```bash
make scale-workers N=5
```

**Docker Compose:**
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale worker=5
```

**Fly.io:**
```bash
flyctl scale count 5 -a monorepo-worker
```

### Auto-Scaling Strategies

#### Based on Queue Length

```bash
#!/bin/bash
# Auto-scale workers based on Redis queue length

QUEUE_LENGTH=$(redis-cli LLEN jobs:pending)
CURRENT_WORKERS=$(docker compose ps worker | grep -c "Up")

if [ $QUEUE_LENGTH -gt 100 ] && [ $CURRENT_WORKERS -lt 5 ]; then
  echo "Scaling up workers..."
  docker compose up -d --scale worker=5
elif [ $QUEUE_LENGTH -lt 10 ] && [ $CURRENT_WORKERS -gt 1 ]; then
  echo "Scaling down workers..."
  docker compose up -d --scale worker=2
fi
```

## Backup Operations

### Database Backup

**Create Backup:**
```bash
make db-backup
```

Backups are stored in `./backups/db/` with format: `backup_YYYYMMDD_HHMMSS.sql.gz`

**Verify Backup:**
```bash
gunzip -t ./backups/db/backup_20240101_120000.sql.gz
```

**List Backups:**
```bash
ls -lh ./backups/db/
```

### Storage Backup

**Create Backup:**
```bash
make storage-backup
```

This syncs your S3 bucket to a backup bucket.

### Automated Backups

**Setup Daily Backups:**

Create `/etc/cron.d/monorepo-backup`:
```
# Daily database backup at 2 AM
0 2 * * * root cd /path/to/project && ./scripts/backup/backup-db.sh

# Weekly storage backup on Sunday at 3 AM
0 3 * * 0 root cd /path/to/project && ./scripts/backup/backup-storage.sh
```

## Database Operations

### Run Migrations

```bash
make db-migrate
```

### Create New Migration

1. Create file in `scripts/db/migrations/`:
   ```bash
   nano scripts/db/migrations/002_add_payments_table.sql
   ```

2. Add migration SQL:
   ```sql
   CREATE TABLE payments (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID REFERENCES users(id),
     amount DECIMAL(10, 2) NOT NULL,
     status VARCHAR(50) DEFAULT 'pending',
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );
   ```

3. Run migration:
   ```bash
   make db-migrate
   ```

### Database Backup and Restore

**Create Backup:**
```bash
make db-backup
```

**Restore Backup:**
```bash
make db-restore FILE=./backups/db/backup_20240101_120000.sql.gz
```

### Database Maintenance

**Vacuum Database:**
```bash
docker compose exec postgres psql -U postgres -d monorepo -c "VACUUM ANALYZE;"
```

**Check Database Size:**
```bash
docker compose exec postgres psql -U postgres -d monorepo -c "\l+"
```

**Check Table Sizes:**
```bash
docker compose exec postgres psql -U postgres -d monorepo -c "\dt+"
```

## Worker Management

### Monitor Worker Status

**Check Running Workers:**
```bash
docker compose ps worker
```

**View Worker Logs:**
```bash
docker compose logs -f worker
```

**Check Queue Status:**
```bash
redis-cli LLEN jobs:pending
redis-cli LLEN jobs:processing
redis-cli LLEN jobs:failed
```

### Restart Workers

**All Workers:**
```bash
docker compose restart worker
```

**Specific Worker:**
```bash
docker compose restart worker_1
```

### Clear Failed Jobs

```bash
# View failed jobs
redis-cli LRANGE jobs:failed 0 -1

# Clear failed jobs queue
redis-cli DEL jobs:failed
```

## Webhook Management

### Setup Webhooks

```bash
make setup-webhooks
```

### Verify Telegram Webhook

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
```

### Test Webhook Endpoints

**Test Telegram Webhook:**
```bash
curl -X POST https://your-domain.com/webhook/telegram \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: ${TELEGRAM_WEBHOOK_SECRET}" \
  -d '{"update_id": 1, "message": {"text": "test"}}'
```

**Test YooKassa Webhook:**
```bash
curl -X POST https://your-domain.com/webhook/yookassa \
  -H "Content-Type: application/json" \
  -d '{"type": "payment.succeeded", "event": "payment.succeeded"}'
```

### Remove Webhook

**Telegram:**
```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook"
```

## Log Management

### View Logs

**All Services:**
```bash
docker compose logs -f
```

**Specific Service:**
```bash
docker compose logs -f api
docker compose logs -f bot
docker compose logs -f worker
```

**Last N Lines:**
```bash
docker compose logs --tail=100 api
```

**Filter by Time:**
```bash
docker compose logs --since 1h api
docker compose logs --since "2024-01-01T00:00:00" api
```

### Log Rotation

Configure log rotation in `/etc/logrotate.d/monorepo`:

```
/var/log/monorepo/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        docker compose restart nginx
    endscript
}
```

### Export Logs

```bash
# Export logs to file
docker compose logs --no-color > logs-$(date +%Y%m%d).txt

# Export specific service logs
docker compose logs --no-color api > api-logs-$(date +%Y%m%d).txt
```

## Performance Tuning

### Database Optimization

**Analyze Query Performance:**
```sql
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
```

**Add Indexes:**
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_jobs_status_created ON jobs(status, created_at);
```

**Optimize Connection Pool:**
Set in environment:
```env
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10
```

### Redis Optimization

**Check Memory Usage:**
```bash
redis-cli INFO memory
```

**Set Max Memory:**
```bash
redis-cli CONFIG SET maxmemory 256mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Worker Optimization

**Adjust Concurrency:**
```env
WORKER_CONCURRENCY=10
WORKER_MAX_JOBS_PER_WORKER=50
```

**Monitor Worker Performance:**
```bash
# Check CPU usage
docker stats worker

# Check memory usage
docker compose exec worker ps aux
```

## Incident Response

### Service Down

1. **Check service status:**
   ```bash
   docker compose ps
   ```

2. **Check logs:**
   ```bash
   docker compose logs --tail=100 api
   ```

3. **Restart service:**
   ```bash
   docker compose restart api
   ```

4. **If persists, redeploy:**
   ```bash
   make docker-deploy
   ```

### High CPU Usage

1. **Identify service:**
   ```bash
   docker stats
   ```

2. **Check logs for errors:**
   ```bash
   docker compose logs --tail=200 worker
   ```

3. **Scale horizontally:**
   ```bash
   make scale-workers N=5
   ```

### Database Connection Issues

1. **Check PostgreSQL status:**
   ```bash
   docker compose ps postgres
   ```

2. **Check connections:**
   ```bash
   docker compose exec postgres psql -U postgres -c "SELECT count(*) FROM pg_stat_activity;"
   ```

3. **Restart PostgreSQL:**
   ```bash
   docker compose restart postgres
   ```

### Queue Backed Up

1. **Check queue length:**
   ```bash
   redis-cli LLEN jobs:pending
   ```

2. **Scale workers:**
   ```bash
   make scale-workers N=10
   ```

3. **Check for stuck jobs:**
   ```bash
   redis-cli LRANGE jobs:processing 0 10
   ```

### Webhook Not Receiving Events

1. **Verify webhook is set:**
   ```bash
   curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"
   ```

2. **Check API logs:**
   ```bash
   docker compose logs -f api | grep webhook
   ```

3. **Test webhook manually:**
   ```bash
   curl -X POST https://your-domain.com/webhook/telegram
   ```

4. **Reset webhook:**
   ```bash
   make setup-webhooks
   ```

## Maintenance Windows

### Planned Maintenance

1. **Notify users** (if applicable)

2. **Create backup:**
   ```bash
   make db-backup
   make storage-backup
   ```

3. **Enable maintenance mode** (set up maintenance page in nginx)

4. **Perform maintenance** (migrations, updates, etc.)

5. **Verify services:**
   ```bash
   ./scripts/monitoring/health-check.sh
   ```

6. **Disable maintenance mode**

7. **Monitor for issues**

### Zero-Downtime Deployment

For Docker Compose with multiple replicas:

```bash
# Scale up new version
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale api=4

# Wait for health checks
sleep 30

# Scale down old version
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale api=2
```

## Emergency Procedures

### Complete System Restore

1. **Stop all services:**
   ```bash
   docker compose down
   ```

2. **Restore database:**
   ```bash
   make db-restore FILE=./backups/db/backup_20240101_120000.sql.gz
   ```

3. **Restore storage:**
   ```bash
   aws s3 sync s3://backup-bucket/storage-backups/20240101_120000/ s3://production-bucket/
   ```

4. **Start services:**
   ```bash
   make docker-deploy
   ```

5. **Verify:**
   ```bash
   ./scripts/monitoring/health-check.sh
   ```

### Rollback Deployment

**Docker Compose:**
```bash
git checkout <previous-commit>
make docker-deploy
```

**Fly.io:**
```bash
flyctl releases -a monorepo-api
flyctl releases rollback <version> -a monorepo-api
```

## Monitoring Checklist

### Daily
- [ ] Check service health
- [ ] Review error logs
- [ ] Monitor queue lengths
- [ ] Check disk space

### Weekly
- [ ] Review performance metrics
- [ ] Check database size
- [ ] Review backup status
- [ ] Update dependencies (security patches)

### Monthly
- [ ] Test backup restoration
- [ ] Review and optimize database
- [ ] Update documentation
- [ ] Review scaling requirements
- [ ] Security audit

---

For more information:
- [Deployment Guide](./DEPLOYMENT.md)
- [Quickstart Guide](./QUICKSTART.md)
- [Main README](../README.md)
