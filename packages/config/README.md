# @monorepo/config

Centralized configuration management for all services using dotenv-flow and zod validation.

## Features

- 🔐 **Environment Variables**: Automatic loading from `.env` files using dotenv-flow
- ✅ **Validation**: Runtime validation of required variables using zod
- 🎯 **Type Safety**: Full TypeScript support with inferred types
- 🛠️ **Service-Specific**: Separate configuration helpers for each service
- 🔄 **Sensible Defaults**: Default values for optional configurations
- 🚨 **Error Handling**: Clear error messages for missing or invalid variables

## Installation

This package is part of the monorepo and is used by all services:

```bash
pnpm install
```

## Usage

### API Service

```typescript
import { getApiConfig } from '@monorepo/config';

const config = getApiConfig();

console.log(config.apiPort);        // number
console.log(config.apiBaseUrl);     // string
console.log(config.jwtSecret);      // string
console.log(config.databaseUrl);    // string (computed)
console.log(config.redisUrl);       // string (computed)
```

### Bot Service

```typescript
import { getBotConfig } from '@monorepo/config';

const config = getBotConfig();

console.log(config.telegramBotToken);      // string (required)
console.log(config.telegramWebhookUrl);    // string | undefined
console.log(config.yookassaShopId);        // string | undefined
console.log(config.databaseUrl);           // string (computed)
```

### Worker Service

```typescript
import { getWorkerConfig } from '@monorepo/config';

const config = getWorkerConfig();

console.log(config.workerConcurrency);     // number
console.log(config.storageType);           // 'local' | 's3'
console.log(config.s3Bucket);              // string | undefined
console.log(config.redisUrl);              // string (computed)
```

### Base Configuration (Common)

```typescript
import { getBaseConfig, getRedisUrl, getDatabaseUrl } from '@monorepo/config';

const config = getBaseConfig();

console.log(config.nodeEnv);          // 'development' | 'production' | 'test'
console.log(config.logLevel);         // 'debug' | 'info' | 'warn' | 'error' | 'fatal'
console.log(config.enableMetrics);    // boolean
console.log(config.sentryEnabled);    // boolean

// Compute URLs from components
const redisUrl = getRedisUrl(config);
```

## Environment Variables

### Common Variables (All Services)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NODE_ENV` | string | `development` | Node environment (development, production, test) |
| `PORT` | number | `3000` | Service port |
| `LOG_LEVEL` | string | `info` | Logging level (debug, info, warn, error, fatal) |
| `ENABLE_METRICS` | boolean | `false` | Enable Prometheus metrics |
| `METRICS_PORT` | number | `9091` | Metrics server port |
| `SENTRY_ENABLED` | boolean | `false` | Enable Sentry error tracking |
| `SENTRY_DSN` | string | - | Sentry DSN URL |
| `SENTRY_TRACES_SAMPLE_RATE` | number | `1.0` | Sentry traces sample rate |
| `SENTRY_PROFILES_SAMPLE_RATE` | number | `1.0` | Sentry profiles sample rate |
| `ALERT_WEBHOOK_URL` | string | - | Webhook URL for alerts (e.g., Slack) |
| `REDIS_HOST` | string | `localhost` | Redis host |
| `REDIS_PORT` | number | `6379` | Redis port |
| `REDIS_PASSWORD` | string | - | Redis password |
| `REDIS_URL` | string | - | Redis connection URL (overrides individual components) |

### Database Variables (API, Bot)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `POSTGRES_HOST` | string | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | number | `5432` | PostgreSQL port |
| `POSTGRES_DB` | string | `monorepo` | Database name |
| `POSTGRES_USER` | string | `postgres` | Database user |
| `POSTGRES_PASSWORD` | string | `postgres` | Database password |
| `DATABASE_URL` | string | - | Database connection URL (overrides individual components) |

### API Service Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `API_PORT` | number | `3000` | API server port |
| `API_BASE_URL` | string | `http://localhost:3000` | API base URL |
| `JWT_SECRET` | string | **REQUIRED** | JWT secret key for authentication |

### Bot Service Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | string | **REQUIRED** | Telegram bot token |
| `TELEGRAM_WEBHOOK_DOMAIN` | string | - | Webhook domain |
| `TELEGRAM_WEBHOOK_PATH` | string | `/webhook/telegram` | Webhook path |
| `TELEGRAM_WEBHOOK_URL` | string | - | Full webhook URL |
| `TELEGRAM_WEBHOOK_SECRET` | string | - | Webhook secret for validation |
| `YOOKASSA_SHOP_ID` | string | - | YooKassa shop ID |
| `YOOKASSA_SECRET_KEY` | string | - | YooKassa secret key |
| `YOOKASSA_WEBHOOK_URL` | string | - | YooKassa webhook URL |
| `YOOKASSA_WEBHOOK_SECRET` | string | - | YooKassa webhook secret |

### Worker Service Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WORKER_CONCURRENCY` | number | `5` | Number of concurrent jobs |
| `WORKER_REPLICAS` | number | `1` | Number of worker replicas |
| `WORKER_MAX_JOBS_PER_WORKER` | number | `50` | Max jobs per worker |
| `STORAGE_TYPE` | string | `local` | Storage backend (local, s3) |
| `STORAGE_BASE_URL` | string | `http://localhost/static` | Base URL for static files |
| `STORAGE_LOCAL_PATH` | string | `/var/www/storage` | Local storage path |
| `S3_ENDPOINT` | string | - | S3 endpoint (for MinIO, Wasabi, etc.) |
| `S3_REGION` | string | `us-east-1` | AWS region |
| `S3_BUCKET` | string | - | S3 bucket name |
| `S3_ACCESS_KEY_ID` | string | - | AWS access key |
| `S3_SECRET_ACCESS_KEY` | string | - | AWS secret key |

## Environment Files

This package uses `dotenv-flow` which supports multiple environment files with priority:

1. `.env.local` - Local overrides (highest priority, gitignored)
2. `.env.[NODE_ENV].local` - Environment-specific local overrides (gitignored)
3. `.env.[NODE_ENV]` - Environment-specific config
4. `.env` - Base configuration (lowest priority)

Example structure:
```
project/
├── .env                    # Base config (committed)
├── .env.development        # Dev-specific config (committed)
├── .env.production         # Prod-specific config (committed)
├── .env.local              # Local overrides (gitignored)
└── .env.development.local  # Dev local overrides (gitignored)
```

## Validation

Configuration is validated at runtime using zod schemas. If validation fails, the application will:

1. Print clear error messages showing which variables are invalid
2. Show the validation error for each field
3. Throw an error preventing the application from starting

Example validation error:
```
❌ Invalid Bot configuration:
  - telegramBotToken: Required
  - jwtSecret: String must contain at least 1 character(s)
Error: Bot configuration validation failed
```

## Type Safety

All configuration functions return fully typed objects:

```typescript
const config = getApiConfig();
// config is typed as ApiConfig

config.apiPort;           // number
config.nodeEnv;           // 'development' | 'production' | 'test'
config.enableMetrics;     // boolean
config.jwtSecret;         // string
```

## Testing

You can create test configurations by setting environment variables:

```typescript
import { getApiConfig } from '@monorepo/config';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.ENABLE_METRICS = 'false';

const config = getApiConfig();
```

Or use the `createMockEnv` helper from `@monorepo/test-utils`:

```typescript
import { createMockEnv } from '@monorepo/test-utils';

const cleanup = createMockEnv({
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret',
  TELEGRAM_BOT_TOKEN: 'test-token',
});

// Run tests...

cleanup(); // Restore original environment
```

## Migration Guide

If you're migrating from the old `getConfig()` function:

### Before
```typescript
import { getConfig } from '@monorepo/config';

const config = getConfig();
// Limited to base config only
```

### After
```typescript
// For API service
import { getApiConfig } from '@monorepo/config';
const config = getApiConfig();

// For Bot service
import { getBotConfig } from '@monorepo/config';
const config = getBotConfig();

// For Worker service
import { getWorkerConfig } from '@monorepo/config';
const config = getWorkerConfig();

// For base config only
import { getBaseConfig } from '@monorepo/config';
const config = getBaseConfig();
```

The old `getConfig()` function is still available for backward compatibility but is deprecated.
