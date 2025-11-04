# API Service

Fastify-based REST API service for the Telegram bot with AI generation and subscription management.

## Features

- **Fastify Framework**: High-performance web framework with schema validation
- **Swagger Documentation**: Interactive API documentation at `/docs`
- **JWT Authentication**: Secure token-based authentication
- **Prisma Integration**: Type-safe database access through shared package
- **Modular Architecture**: Clean separation of routes, controllers, services, and schemas
- **Graceful Shutdown**: Proper cleanup of resources on shutdown
- **Pino Logging**: Structured JSON logging with request tracking
- **Health Checks**: Basic and detailed health endpoints
- **Rate Limiting**: Built-in rate limiting for API protection
- **Security Headers**: Helmet integration for security best practices
- **CORS Support**: Cross-origin resource sharing enabled

## Project Structure

```
src/
├── index.ts                 # Entry point with bootstrap
├── app.ts                   # Fastify app factory
├── config/
│   └── swagger.ts           # Swagger/OpenAPI configuration
├── plugins/
│   ├── database.ts          # Prisma database plugin
│   ├── monitoring.ts        # Monitoring and logging plugin
│   └── auth.ts              # JWT authentication plugin
├── middleware/
│   └── auth.ts              # Authentication middleware
├── routes/
│   ├── health/              # Health check routes
│   ├── auth/                # Authentication routes
│   └── index.ts             # Route aggregator
├── controllers/
│   ├── health.controller.ts # Health check controller
│   └── auth.controller.ts   # Authentication controller
├── services/
│   └── auth.service.ts      # Authentication business logic
├── schemas/
│   ├── health.schema.ts     # Health endpoint validation schemas
│   └── auth.schema.ts       # Auth endpoint validation schemas
└── types/
    └── index.ts             # TypeScript type definitions
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm
- PostgreSQL database

### Installation

```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm db:migrate:dev

# Generate Prisma client
pnpm db:generate
```

### Configuration

Required environment variables:

```env
# API Configuration
API_PORT=3000
API_BASE_URL=http://localhost:3000
JWT_SECRET=your-secret-key-here

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Optional
NODE_ENV=development
LOG_LEVEL=info
ENABLE_METRICS=true
METRICS_PORT=9091
```

See `.env.example` for a complete list of environment variables.

### Development

```bash
# Run in development mode with hot reload
pnpm dev

# Type check
pnpm typecheck

# Lint
pnpm lint

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

### Production

```bash
# Build the service
pnpm build

# Run production build
pnpm start
```

## API Endpoints

### Health Check

- `GET /api/v1/health` - Basic health check
- `GET /api/v1/health/detailed` - Detailed health with database and memory info

### Authentication

- `POST /api/v1/auth/login` - Login or register user via Telegram ID
- `GET /api/v1/auth/me` - Get current authenticated user (requires JWT)

### Documentation

- `GET /docs` - Swagger UI interactive documentation

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. To access protected endpoints:

1. Call `POST /api/v1/auth/login` with your Telegram ID to get a JWT token
2. Include the token in the `Authorization` header: `Bearer <token>`
3. Protected routes will verify the token and extract user information

Example:

```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"telegramId": 123456789, "username": "testuser"}'

# Use token
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <your-token>"
```

## Plugins

### Database Plugin

Provides Prisma client access to all routes via `fastify.db`. Handles graceful shutdown and disconnection.

### Monitoring Plugin

Integrates with the monitoring package for:
- Request/response logging
- Error tracking
- Performance metrics
- KPI tracking

### Auth Plugin

Provides JWT signing and verification:
- Token generation with 7-day expiration
- Token verification middleware
- `fastify.authenticate` decorator for protected routes

## Error Handling

All errors are handled centrally and return a consistent format:

```json
{
  "error": "Error name",
  "message": "Error description",
  "statusCode": 400
}
```

Common status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `404` - Not Found
- `500` - Internal Server Error

## Testing

The API service includes comprehensive tests:

### Unit Tests

Located in `src/__tests__/unit/`:
- Service layer logic
- Business logic validation
- Mocked dependencies

### Integration Tests

Located in `src/__tests__/integration/`:
- Full request/response cycle
- Database interactions
- Authentication flows

Run tests:

```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

## Graceful Shutdown

The service handles graceful shutdown on:
- `SIGTERM` signal
- `SIGINT` signal (Ctrl+C)
- Uncaught exceptions
- Unhandled promise rejections

Shutdown sequence:
1. Stop accepting new requests
2. Complete in-flight requests
3. Close Fastify server
4. Stop metrics server
5. Disconnect database
6. Exit process

## Monitoring

When metrics are enabled (`ENABLE_METRICS=true`), the service exposes:

- Prometheus metrics at `http://localhost:9091/metrics`
- Request/response metrics
- Database query metrics
- Error tracking
- Custom KPI metrics

## Contributing

1. Follow the existing code structure and patterns
2. Add tests for new features
3. Update documentation as needed
4. Use TypeScript strict mode
5. Follow the project's code style guidelines

## License

Private - All rights reserved
