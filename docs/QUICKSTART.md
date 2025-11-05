# Deployment Quickstart

Get your application deployed in minutes using any of these platforms.

## 🚀 Choose Your Deployment Method

- [Docker Compose (Self-hosted)](#docker-compose-self-hosted)
- [Fly.io (Recommended)](#flyio-recommended)
- [Railway](#railway)

---

## Docker Compose (Self-hosted)

Perfect for deploying on your own VPS or server.

### Prerequisites

- Docker & Docker Compose installed
- Domain name (for webhooks)

### Steps

1. **Clone and configure**

   ```bash
   git clone <your-repo>
   cd monorepo
   cp .env.example .env
   ```

2. **Edit `.env` file** with your credentials

3. **Deploy**

   ```bash
   make docker-deploy
   ```

4. **Setup webhooks**
   ```bash
   make setup-webhooks
   ```

That's it! Your services are now running at:

- API: http://localhost:3000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### Common Commands

```bash
make docker-logs      # View logs
make docker-down      # Stop services
make scale-workers N=5 # Scale workers
make db-backup        # Backup database
```

---

## Fly.io (Recommended)

Fly.io provides global distribution with excellent performance.

### Prerequisites

- Fly.io account (free tier available)
- flyctl CLI installed

### Steps

1. **Install flyctl**

   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login**

   ```bash
   flyctl auth login
   ```

3. **Create database and Redis**

   ```bash
   flyctl postgres create --name monorepo-db --region iad
   flyctl redis create --name monorepo-redis --region iad
   ```

4. **Get connection strings**

   ```bash
   flyctl postgres db list -a monorepo-db
   flyctl redis status -a monorepo-redis
   ```

5. **Deploy all services**

   ```bash
   make fly-deploy
   ```

6. **Set secrets** (use values from step 4 and your .env)

   ```bash
   # API
   flyctl secrets set DATABASE_URL="..." REDIS_URL="..." \
     YOOKASSA_SHOP_ID="..." YOOKASSA_SECRET_KEY="..." \
     JWT_SECRET="..." -a monorepo-api

   # Bot
   flyctl secrets set DATABASE_URL="..." REDIS_URL="..." \
     TELEGRAM_BOT_TOKEN="..." \
     TELEGRAM_WEBHOOK_DOMAIN="monorepo-api.fly.dev" \
     -a monorepo-bot

   # Worker
   flyctl secrets set DATABASE_URL="..." REDIS_URL="..." \
     S3_ACCESS_KEY_ID="..." S3_SECRET_ACCESS_KEY="..." \
     -a monorepo-worker
   ```

7. **Run migrations**

   ```bash
   flyctl ssh console -a monorepo-api -C "npm run migrate"
   ```

8. **Setup webhooks**
   Set `TELEGRAM_WEBHOOK_DOMAIN` to your Fly.io domain (e.g., `monorepo-api.fly.dev`), then:
   ```bash
   make setup-webhooks
   ```

Your app is live! Access it at `https://monorepo-api.fly.dev`

### Common Commands

```bash
flyctl logs -a monorepo-api        # View logs
flyctl status -a monorepo-api      # Check status
flyctl scale count 2 -a monorepo-api  # Scale API
flyctl scale count 3 -a monorepo-worker # Scale workers
```

---

## Railway

Railway provides the simplest deployment with automatic environments.

### Prerequisites

- Railway account (free tier available)
- Railway CLI installed

### Steps

1. **Install Railway CLI**

   ```bash
   npm install -g @railway/cli
   ```

2. **Login**

   ```bash
   railway login
   ```

3. **Create project**

   ```bash
   railway init
   ```

4. **Add services via Railway Dashboard**
   - Go to your project at railway.app
   - Add PostgreSQL database
   - Add Redis
   - Note the connection strings

5. **Deploy services**

   ```bash
   make railway-deploy
   ```

6. **Set environment variables**
   Via Railway Dashboard or CLI:

   ```bash
   railway variables set DATABASE_URL="..."
   railway variables set REDIS_URL="..."
   railway variables set TELEGRAM_BOT_TOKEN="..."
   railway variables set YOOKASSA_SHOP_ID="..."
   railway variables set YOOKASSA_SECRET_KEY="..."
   ```

7. **Setup webhooks**
   Get your Railway domain from the dashboard, update `TELEGRAM_WEBHOOK_DOMAIN` in environment variables, then:
   ```bash
   make setup-webhooks
   ```

Your app is live! Access it via your Railway domain.

### Common Commands

```bash
railway logs           # View logs
railway status         # Check status
railway open          # Open in browser
```

---

## Next Steps

After deployment:

1. **Test your deployment**
   - Check API health: `curl https://your-domain.com/health`
   - Verify bot responds to Telegram messages
   - Check worker is processing jobs

2. **Setup monitoring**
   - Configure error tracking (Sentry)
   - Setup uptime monitoring
   - Enable log aggregation

3. **Configure backups**

   ```bash
   # Setup automated backups (cron job)
   0 2 * * * cd /path/to/project && make db-backup
   ```

4. **Security hardening**
   - Change all default passwords
   - Enable HTTPS (most platforms do this automatically)
   - Configure firewall rules
   - Setup rate limiting

5. **Performance tuning**
   - Scale workers based on load: `make scale-workers N=5`
   - Enable caching
   - Optimize database queries

## Troubleshooting

### Services won't start

```bash
# Check logs
docker compose logs  # Docker
flyctl logs -a monorepo-api  # Fly.io
railway logs  # Railway
```

### Webhook not working

- Verify domain is correct and publicly accessible
- Check webhook secret matches
- Ensure SSL certificate is valid

### Database connection issues

- Verify DATABASE_URL is correct
- Check if database is running
- Test connection manually

### Need more help?

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive documentation.

---

## Comparison

| Feature    | Docker Compose            | Fly.io                  | Railway          |
| ---------- | ------------------------- | ----------------------- | ---------------- |
| Setup Time | 5 min                     | 10 min                  | 5 min            |
| Free Tier  | No (own server)           | Yes                     | Yes              |
| Global CDN | No                        | Yes                     | Yes              |
| Auto HTTPS | No                        | Yes                     | Yes              |
| Scaling    | Manual                    | Easy                    | Easy             |
| Cost       | Server cost               | $0-20/mo                | $0-20/mo         |
| Best For   | Self-hosted, full control | Production, global apps | Quick prototypes |

Choose based on your needs:

- **Docker Compose**: Full control, self-hosted
- **Fly.io**: Production-ready, global distribution
- **Railway**: Fastest setup, simple deployment
