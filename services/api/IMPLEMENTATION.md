# API Service Implementation

## Overview

This document describes the implementation of the Fastify-based API service scaffold.

## Architecture

### Technology Stack

- **Framework**: Fastify 5.x (high-performance web framework)
- **Authentication**: JWT with @fastify/jwt
- **Documentation**: Swagger/OpenAPI with @fastify/swagger and @fastify/swagger-ui
- **Database**: Prisma via shared package (@monorepo/shared)
- **Logging**: Pino via monitoring package (@monorepo/monitoring)
- **Validation**: Zod with zod-to-json-schema
- **Security**: @fastify/helmet, @fastify/cors, @fastify/rate-limit
- **Type Safety**: TypeScript with strict mode

### Directory Structure

```
src/
├── index.ts                      # Entry point with bootstrap and graceful shutdown
├── app.ts                        # Fastify app factory with plugins and routes
├── config/
│   └── swagger.ts                # Swagger/OpenAPI configuration
├── plugins/
│   ├── database.ts               # Prisma database plugin
│   ├── monitoring.ts             # Monitoring and logging plugin
│   └── auth.ts                   # JWT authentication plugin
├── middleware/
│   └── auth.ts                   # Authentication middleware helpers
├── routes/
│   ├── health/
│   │   └── index.ts              # Health check routes
│   ├── auth/
│   │   └── index.ts              # Authentication routes
│   └── index.ts                  # Route aggregator
├── controllers/
│   ├── health.controller.ts      # Health check controller
│   └── auth.controller.ts        # Authentication controller
├── services/
│   └── auth.service.ts           # Authentication business logic
├── schemas/
│   ├── health.schema.ts          # Health endpoint validation schemas
│   └── auth.schema.ts            # Auth endpoint validation schemas
├── types/
│   └── index.ts                  # TypeScript type definitions
└── __tests__/
    ├── unit/
    │   └── auth.service.test.ts  # Unit tests for services
    └── integration/
        ├── health.test.ts        # Integration tests for health endpoints
        └── auth.test.ts          # Integration tests for auth endpoints
```

## Key Features Implemented

### 1. Modular Architecture

- **Routes**: Route handlers organized by domain (health, auth)
- **Controllers**: Business logic separated from route definitions
- **Services**: Data access and domain logic layer
- **Plugins**: Reusable functionality (database, monitoring, auth)
- **Schemas**: Zod schemas with automatic JSON schema conversion for Swagger

### 2. Health Checks

- `GET /api/v1/health` - Basic health check
- `GET /api/v1/health/detailed` - Detailed health with database connectivity and memory info

### 3. Authentication System

- JWT-based authentication with 7-day token expiration
- `POST /api/v1/auth/login` - Login/register via Telegram ID
- `GET /api/v1/auth/me` - Get authenticated user (protected route)
- Automatic user creation on first login with Gift tier

### 4. Swagger Documentation

- Interactive API documentation at `/docs`
- Automatic schema generation from Zod schemas
- Bearer token authentication support
- Request/response examples

### 5. Database Integration

- Prisma client via shared package
- Graceful connection handling
- Automatic disconnection on shutdown
- Type-safe database queries

### 6. Monitoring & Logging

- Pino structured logging via monitoring package
- Request/response logging
- Error tracking and reporting
- Prometheus metrics support (when enabled)

### 7. Security

- Helmet for security headers
- CORS support with credentials
- Rate limiting (100 requests per minute)
- JWT token verification
- Input validation with Zod

### 8. Graceful Shutdown

- Proper cleanup on SIGTERM/SIGINT
- Closes Fastify server
- Disconnects database
- Stops metrics server
- Configurable timeout (10 seconds)

## API Endpoints

### Health

```
GET /api/v1/health
Response: { status, timestamp, uptime, service, version }

GET /api/v1/health/detailed
Response: { status, timestamp, uptime, service, version, database, memory }
```

### Authentication

```
POST /api/v1/auth/login
Body: { telegramId: number, username?: string }
Response: { token: string, user: { id, telegramId, username, tier } }

GET /api/v1/auth/me
Headers: { Authorization: "Bearer <token>" }
Response: { id, telegramId, username, tier, tokensBalance, tokensSpent }
```

### Documentation

```
GET /docs
Interactive Swagger UI
```

## Configuration

Required environment variables:

- `JWT_SECRET` - JWT signing secret (required)
- `API_PORT` - Server port (default: 3000)
- `API_BASE_URL` - API base URL (default: http://localhost:3000)
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Environment (development, production, test)
- `LOG_LEVEL` - Logging level (default: info)
- `ENABLE_METRICS` - Enable Prometheus metrics (default: false)
- `METRICS_PORT` - Metrics server port (default: 9091)

## Error Handling

Centralized error handler with consistent response format:

```json
{
  "error": "Error name",
  "message": "Error description",
  "statusCode": 400
}
```

HTTP status codes:
- 200: Success
- 400: Bad Request (validation errors)
- 401: Unauthorized (invalid/missing token)
- 404: Not Found
- 500: Internal Server Error

## Testing

### Unit Tests

- Service layer logic tested with mocked dependencies
- Located in `src/__tests__/unit/`
- Focus on business logic validation

### Integration Tests

- Full request/response cycle testing
- Real database interactions (test database)
- Located in `src/__tests__/integration/`
- Test authentication flows

Run tests:
```bash
pnpm test              # Run all tests
pnpm test:watch        # Watch mode
pnpm test:coverage     # Coverage report
```

## Development Workflow

1. Install dependencies: `pnpm install`
2. Run database migrations: `pnpm db:migrate:dev`
3. Generate Prisma client: `pnpm db:generate`
4. Start development server: `pnpm dev`
5. Access Swagger docs: http://localhost:3000/docs
6. Run tests: `pnpm test`

## Production Deployment

1. Build the service: `pnpm build`
2. Set environment variables
3. Run migrations: `pnpm db:migrate:deploy`
4. Start server: `pnpm start`

## Next Steps

Potential enhancements:
- Add more authentication methods (OAuth, API keys)
- Implement refresh tokens
- Add user profile management endpoints
- Implement role-based access control
- Add request/response caching
- Implement API versioning
- Add more comprehensive error codes
- Implement request tracing
- Add integration with message queue for async operations

## Notes

- All database IDs are UUIDs (string type)
- Telegram IDs are stored as strings but exposed as numbers in API
- Default subscription tier is "Gift" with 100 tokens
- JWT tokens expire after 7 days
- Rate limit: 100 requests per minute per IP
- Graceful shutdown timeout: 10 seconds
