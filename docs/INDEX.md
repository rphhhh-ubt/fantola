# Documentation Index

Welcome to the monorepo documentation! This index will help you find the information you need quickly.

## 📖 Documentation Structure

### Getting Started
- **[Main README](../README.md)** - Project overview, architecture, and local development setup
- **[CONTRIBUTING](../CONTRIBUTING.md)** - Contribution guidelines and development workflow

### Deployment
- **[Quickstart Guide](QUICKSTART.md)** ⭐ *Start here for deployment*
  - Quick deployment instructions (5-10 minutes)
  - Step-by-step guides for each platform
  - Platform comparison

- **[Deployment Guide](DEPLOYMENT.md)** 📚 *Comprehensive reference*
  - Detailed deployment procedures
  - Environment configuration
  - Platform-specific instructions
  - Database migrations
  - Webhook setup
  - Scaling strategies
  - Troubleshooting

- **[Operations Guide](OPERATIONS.md)** 🔧 *Day-to-day operations*
  - Health monitoring
  - Scaling procedures
  - Backup and restore
  - Database maintenance
  - Worker management
  - Log management
  - Incident response

- **[Deployment Summary](../DEPLOYMENT_SUMMARY.md)** 📋 *Quick reference*
  - File structure overview
  - All available commands
  - Environment variables
  - Configuration options

### Platform-Specific
- **[Deploy Directory README](../deploy/README.md)** - Platform configuration details
  - Fly.io setup
  - Railway setup
  - Nginx configuration

## 🎯 Quick Links by Task

### I want to...

#### Deploy the Application
1. First time? → [Quickstart Guide](QUICKSTART.md)
2. Need details? → [Deployment Guide](DEPLOYMENT.md)
3. Updating existing? → [Operations Guide](OPERATIONS.md#deployment)

#### Setup Database
- Initialize database → [Database Operations](DEPLOYMENT.md#database-management)
- Run migrations → `make db-migrate`
- Backup database → [Backup Operations](OPERATIONS.md#backup-operations)

#### Configure Webhooks
- Setup guide → [Webhook Setup](DEPLOYMENT.md#webhook-setup)
- Telegram bot → [Operations: Webhook Management](OPERATIONS.md#webhook-management)
- YooKassa payments → [Deployment: Webhook Setup](DEPLOYMENT.md#webhook-setup)

#### Scale Services
- Scale workers → [Worker Scaling](DEPLOYMENT.md#worker-scaling)
- Scale API → [Scaling Operations](OPERATIONS.md#scaling-operations)
- Auto-scaling → [Operations: Auto-Scaling](OPERATIONS.md#auto-scaling-strategies)

#### Monitor Services
- Health checks → [Health Monitoring](OPERATIONS.md#health-monitoring)
- View logs → [Log Management](OPERATIONS.md#log-management)
- Performance tuning → [Performance Optimization](OPERATIONS.md#performance-tuning)

#### Handle Issues
- Troubleshooting → [Deployment: Troubleshooting](DEPLOYMENT.md#troubleshooting)
- Incident response → [Operations: Incident Response](OPERATIONS.md#incident-response)
- Rollback deployment → [Operations: Rollback](OPERATIONS.md#rollback-deployment)

## 🚀 Deployment Platforms

### Docker Compose
- **Best for:** Self-hosted, full control
- **Setup time:** 5 minutes
- **Cost:** Server costs only
- **Guide:** [Quickstart: Docker Compose](QUICKSTART.md#docker-compose-self-hosted)

### Fly.io
- **Best for:** Production apps, global distribution
- **Setup time:** 10 minutes
- **Cost:** Free tier available, then pay-as-you-go
- **Guide:** [Quickstart: Fly.io](QUICKSTART.md#flyio-recommended)

### Railway
- **Best for:** Quick prototypes, simple deployment
- **Setup time:** 5 minutes
- **Cost:** Free tier available, then pay-as-you-go
- **Guide:** [Quickstart: Railway](QUICKSTART.md#railway)

## 📂 Key Files and Directories

### Configuration Files
```
.env.example              # Environment variables template
docker-compose.yml        # Docker Compose base configuration
docker-compose.prod.yml   # Production overrides
Dockerfile.api            # API service Docker image
Dockerfile.bot            # Bot service Docker image
Dockerfile.worker         # Worker service Docker image
railway.json              # Railway default configuration
Makefile                  # Deployment and operations commands
```

### Deployment Configurations
```
deploy/
├── fly/                  # Fly.io configurations
│   ├── fly.api.toml
│   ├── fly.bot.toml
│   └── fly.worker.toml
├── railway/              # Railway configurations
│   ├── railway.api.json
│   ├── railway.bot.json
│   └── railway.worker.json
└── nginx/                # Nginx reverse proxy
    └── nginx.conf
```

### Scripts
```
scripts/
├── backup/               # Backup and restore scripts
│   ├── backup-db.sh      # Database backup
│   ├── restore-db.sh     # Database restore
│   └── backup-storage.sh # Storage backup
├── db/                   # Database scripts
│   ├── init.sql          # Database initialization
│   ├── migrate.sh        # Migration runner
│   └── migrations/       # SQL migration files
├── deploy/               # Deployment automation
│   ├── docker-deploy.sh  # Docker deployment
│   ├── fly-deploy.sh     # Fly.io deployment
│   ├── railway-deploy.sh # Railway deployment
│   └── setup-webhooks.sh # Webhook configuration
└── monitoring/           # Monitoring tools
    └── health-check.sh   # Service health checks
```

## 🔧 Common Commands

### Development
```bash
make install              # Install dependencies
make build                # Build all services
make dev                  # Run in development mode
make lint                 # Run linting
make typecheck            # Type checking
make test                 # Run tests
```

### Deployment
```bash
make docker-deploy        # Deploy with Docker Compose
make fly-deploy           # Deploy to Fly.io
make railway-deploy       # Deploy to Railway
```

### Database
```bash
make db-migrate           # Run migrations
make db-backup            # Backup database
make db-restore FILE=...  # Restore from backup
```

### Operations
```bash
make setup-webhooks       # Configure webhooks
make scale-workers N=5    # Scale worker replicas
make docker-logs          # View logs
```

### Monitoring
```bash
./scripts/monitoring/health-check.sh  # Check service health
```

## 🔐 Security Considerations

Before deploying to production, review:
- [Security Checklist](DEPLOYMENT.md#security-checklist)
- Environment variable security
- Database access controls
- Webhook secret configuration
- SSL/TLS setup
- Rate limiting configuration

## 📊 Monitoring and Maintenance

Regular tasks documented in [Operations Guide](OPERATIONS.md):
- Daily: Health checks, log review
- Weekly: Performance metrics, backups verification
- Monthly: Security updates, database optimization

## 🆘 Getting Help

1. **Check Documentation**
   - Search this index for your topic
   - Review the relevant guide
   - Check troubleshooting sections

2. **Review Logs**
   ```bash
   make docker-logs
   ```

3. **Run Health Checks**
   ```bash
   ./scripts/monitoring/health-check.sh
   ```

4. **Platform Documentation**
   - [Fly.io Docs](https://fly.io/docs/)
   - [Railway Docs](https://docs.railway.app/)
   - [Docker Compose Docs](https://docs.docker.com/compose/)

## 📝 Document Summaries

### Quickstart Guide
Get deployed in minutes with step-by-step instructions for:
- Docker Compose setup
- Fly.io deployment
- Railway deployment
- Platform comparison and recommendations

**Read time:** 5 minutes  
**Target audience:** Developers deploying for the first time

### Deployment Guide
Comprehensive reference covering:
- Prerequisites and tools
- Detailed deployment procedures
- Environment configuration
- Database management
- Webhook setup
- Scaling strategies
- Backup and restore
- Troubleshooting

**Read time:** 30 minutes  
**Target audience:** DevOps engineers, detailed implementation

### Operations Guide
Day-to-day operations handbook:
- Health monitoring
- Scaling operations
- Database maintenance
- Worker management
- Log management
- Performance tuning
- Incident response procedures

**Read time:** 20 minutes  
**Target audience:** Operations team, on-call engineers

## 🗺️ Recommended Reading Path

### New to the Project?
1. [Main README](../README.md) - Understand the architecture
2. [Quickstart Guide](QUICKSTART.md) - Deploy quickly
3. [Operations Guide](OPERATIONS.md) - Learn maintenance

### DevOps Engineer?
1. [Deployment Guide](DEPLOYMENT.md) - Detailed procedures
2. [Operations Guide](OPERATIONS.md) - Operational procedures
3. [Deployment Summary](../DEPLOYMENT_SUMMARY.md) - Quick reference

### On-Call Engineer?
1. [Operations Guide](OPERATIONS.md) - Incident response
2. [Deployment Guide: Troubleshooting](DEPLOYMENT.md#troubleshooting)
3. [Health Check Script](../scripts/monitoring/health-check.sh)

## 🔄 Keeping Documentation Updated

This documentation should be updated when:
- New deployment platforms are added
- Configuration changes are made
- New features require deployment steps
- Operational procedures change
- Security best practices evolve

---

**Last Updated:** 2024  
**Maintained by:** Development Team

For questions or improvements, please contribute via pull request.
