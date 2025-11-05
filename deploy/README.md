# Deployment Configurations

This directory contains platform-specific deployment configurations.

## Directory Structure

```
deploy/
├── fly/              # Fly.io configurations
│   ├── fly.api.toml
│   ├── fly.bot.toml
│   └── fly.worker.toml
├── railway/          # Railway configurations
│   ├── railway.api.json
│   ├── railway.bot.json
│   └── railway.worker.json
└── nginx/            # Nginx reverse proxy configuration
    └── nginx.conf
```

## Fly.io Configurations

Each service has its own `fly.*.toml` configuration file:

- **fly.api.toml**: API service with HTTP endpoint
- **fly.bot.toml**: Bot service (long-running process)
- **fly.worker.toml**: Worker service (background jobs)

### Usage

```bash
# Deploy all services
./scripts/deploy/fly-deploy.sh all

# Deploy specific service
./scripts/deploy/fly-deploy.sh api
```

## Railway Configurations

Each service has its own `railway.*.json` configuration file that defines build settings, deployment strategy, and resource allocation.

### Usage

```bash
# Deploy all services
./scripts/deploy/railway-deploy.sh all

# Deploy specific service
./scripts/deploy/railway-deploy.sh worker
```

## Nginx Configuration

The `nginx/nginx.conf` file provides a production-ready reverse proxy configuration with:

- SSL/TLS termination
- Rate limiting
- Security headers
- Load balancing
- WebSocket support

### Usage with Docker Compose

```bash
# Start with nginx
docker compose -f docker-compose.yml -f docker-compose.nginx.yml up -d
```

### SSL Certificates

Place your SSL certificates in `deploy/nginx/ssl/`:

- `cert.pem`: SSL certificate
- `key.pem`: Private key

For Let's Encrypt, use certbot:

```bash
certbot certonly --standalone -d your-domain.com
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem deploy/nginx/ssl/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem deploy/nginx/ssl/key.pem
```

## Platform Comparison

| Feature             | Fly.io           | Railway           | Docker+Nginx  |
| ------------------- | ---------------- | ----------------- | ------------- |
| Setup Complexity    | Medium           | Low               | High          |
| Cost                | Pay-as-you-go    | Free tier + pay   | Server cost   |
| Scaling             | Automatic        | Automatic         | Manual        |
| Global Distribution | Yes              | Yes               | Single region |
| Custom Domains      | Yes              | Yes               | Yes           |
| Database            | Managed Postgres | Managed Postgres  | Self-managed  |
| Best For            | Production apps  | Rapid prototyping | Full control  |

## Environment Variables

All platforms require the same environment variables. See `.env.example` for a complete list.

Key variables:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `TELEGRAM_BOT_TOKEN`: Telegram bot token
- `YOOKASSA_SHOP_ID` & `YOOKASSA_SECRET_KEY`: Payment gateway credentials

## Further Reading

- [Deployment Guide](../docs/DEPLOYMENT.md): Comprehensive deployment documentation
- [Quickstart Guide](../docs/QUICKSTART.md): Quick deployment for each platform
- [Main README](../README.md): Project overview
