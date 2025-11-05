# Testing Strategy

This document outlines the testing strategy for the monorepo, including unit testing, integration testing, and end-to-end testing approaches.

## Table of Contents

- [Testing Framework](#testing-framework)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Mocking Utilities](#mocking-utilities)
- [Testing Types](#testing-types)
- [Coverage Requirements](#coverage-requirements)
- [Docker Testing](#docker-testing)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)

## Testing Framework

We use **Jest** with **ts-jest** for all testing across the monorepo. This provides:

- Fast, parallel test execution
- TypeScript support out of the box
- Built-in mocking capabilities
- Code coverage reporting
- Snapshot testing support

### Key Dependencies

```json
{
  "jest": "^30.2.0",
  "ts-jest": "^29.4.5",
  "@types/jest": "^30.0.0"
}
```

## Running Tests

### Local Development

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run tests for specific workspace
pnpm --filter bot test
pnpm --filter api test
pnpm --filter worker test

# Run tests for all services
pnpm test:services

# Run tests for all packages
pnpm test:packages
```

### CI Environment

```bash
# Run tests optimized for CI
pnpm test:ci
```

This command runs tests with:

- Coverage enabled
- CI optimizations (`--ci` flag)
- Limited parallelism (`--maxWorkers=2`)
- No watch mode

## Test Structure

### Directory Layout

Each workspace follows this structure:

```
workspace/
├── src/
│   ├── __tests__/           # Test files
│   │   ├── *.test.ts        # Unit tests
│   │   └── *.spec.ts        # Integration tests
│   ├── index.ts
│   └── ...
├── jest.config.js           # Jest configuration
├── package.json
└── tsconfig.json
```

### Test File Naming

- **Unit tests**: `*.test.ts`
- **Integration tests**: `*.spec.ts`
- Place test files in `__tests__` directories or colocate them with source files

### Configuration Files

#### Root Configuration (`jest.config.js`)

Defines the monorepo structure and aggregates all workspace tests.

#### Base Configuration (`jest.config.base.js`)

Shared configuration inherited by all workspaces.

#### Workspace Configuration

Each workspace has its own `jest.config.js` that extends the base configuration:

```javascript
const base = require('../../jest.config.base');

module.exports = {
  ...base,
  displayName: 'workspace-name',
};
```

## Mocking Utilities

The `@monorepo/test-utils` package provides comprehensive mocking utilities for external services.

### Telegram Bot Mocks

```typescript
import {
  MockTelegramBot,
  createMockTelegramUpdate,
  createMockTelegramMessage,
} from '@monorepo/test-utils';

describe('Telegram Bot', () => {
  let mockBot: MockTelegramBot;

  beforeEach(() => {
    mockBot = new MockTelegramBot();
  });

  it('should send message', async () => {
    await mockBot.sendMessage(12345, 'Hello');
    expect(mockBot.getSentMessages()).toHaveLength(1);
  });
});
```

### AI Provider Mocks

#### OpenAI

```typescript
import { MockOpenAIClient, createMockAIResponse } from '@monorepo/test-utils';

const openai = new MockOpenAIClient();

// Use default response
const response = await openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Hello' }],
});

// Or set custom response
openai.setMockResponse(
  createMockAIResponse({
    choices: [
      {
        message: { role: 'assistant', content: 'Custom response' },
        finish_reason: 'stop',
      },
    ],
  })
);
```

#### Anthropic

```typescript
import { MockAnthropicClient } from '@monorepo/test-utils';

const anthropic = new MockAnthropicClient();

const response = await anthropic.messages.create({
  model: 'claude-3-opus-20240229',
  messages: [{ role: 'user', content: 'Hello' }],
  max_tokens: 1024,
});
```

### External Service Mocks

#### Redis

```typescript
import { MockRedisClient } from '@monorepo/test-utils';

const redis = new MockRedisClient();

await redis.set('key', 'value', { EX: 60 });
const value = await redis.get('key');
await redis.del('key');
```

#### Database (PostgreSQL)

```typescript
import { MockDatabaseClient } from '@monorepo/test-utils';

const db = new MockDatabaseClient();

const result = await db.query('SELECT * FROM users WHERE id = $1', [1]);
const queries = db.getQueries();
```

#### S3

```typescript
import { MockS3Client } from '@monorepo/test-utils';

const s3 = new MockS3Client();

await s3.putObject({
  Bucket: 'bucket',
  Key: 'key',
  Body: 'content',
});

const obj = await s3.getObject({
  Bucket: 'bucket',
  Key: 'key',
});
```

### Test Helpers

```typescript
import {
  waitFor,
  mockDateNow,
  mockConsole,
  createMockEnv,
  expectToThrow,
} from '@monorepo/test-utils';

// Wait for async operations
await waitFor(1000);

// Mock Date.now()
const dateSpy = mockDateNow(1234567890);

// Mock console methods
const consoleMock = mockConsole();
console.log('test');
expect(consoleMock.log).toHaveBeenCalledWith('test');

// Mock environment variables
createMockEnv({ NODE_ENV: 'test' });
```

## Testing Types

### Unit Tests

Test individual functions, classes, or modules in isolation.

**Characteristics:**

- Fast execution
- No external dependencies
- Heavy use of mocks
- Focus on business logic

**Example:**

```typescript
import { isValidEmail } from '../utils';

describe('isValidEmail', () => {
  it('should validate correct emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(isValidEmail('invalid')).toBe(false);
  });
});
```

### Integration Tests

Test multiple components working together with limited mocking.

**Characteristics:**

- Moderate execution speed
- May use test databases/services
- Tests component interactions
- Validates integration points

**Example:**

```typescript
describe('User Registration Flow', () => {
  let db: MockDatabaseClient;
  let redis: MockRedisClient;

  beforeEach(() => {
    db = new MockDatabaseClient();
    redis = new MockRedisClient();
  });

  it('should register user and cache data', async () => {
    // Test registration flow with multiple components
  });
});
```

### End-to-End Tests

Test complete user workflows through the entire system.

**Characteristics:**

- Slowest execution
- Uses real services (Docker containers)
- Tests full user scenarios
- Validates entire system behavior

**Example:**

```typescript
describe('Complete Bot Interaction', () => {
  it('should handle user message end-to-end', async () => {
    // Test complete flow from Telegram message to response
  });
});
```

## Coverage Requirements

The monorepo enforces minimum coverage thresholds:

```javascript
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
}
```

### Viewing Coverage Reports

After running `pnpm test:coverage`, view the coverage report:

```bash
# Open in browser
open coverage/lcov-report/index.html

# Or view in terminal
cat coverage/coverage-summary.json
```

### Coverage Files

- `coverage/lcov-report/`: HTML coverage report
- `coverage/lcov.info`: LCOV format for CI tools
- `coverage/coverage-summary.json`: JSON summary

## Docker Testing

### Running Tests in Docker

#### Using docker-compose.test.yml

```bash
# Start test environment
docker-compose -f docker-compose.test.yml up --build

# Run tests and remove containers
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit

# Clean up
docker-compose -f docker-compose.test.yml down -v
```

#### Using Makefile (if available)

```bash
make test        # Run tests in Docker
make test-watch  # Run tests in watch mode
```

### Test Environment Variables

Create a `.env.test` file for test-specific configuration:

```bash
# Database
POSTGRES_TEST_DB=monorepo_test
POSTGRES_TEST_USER=postgres
POSTGRES_TEST_PASSWORD=postgres
POSTGRES_TEST_PORT=5433

# Redis
REDIS_TEST_PORT=6380

# Other test variables
NODE_ENV=test
LOG_LEVEL=error
```

### Test Database Setup

The test database is automatically initialized with the schema from `scripts/db/init.sql`.

For test-specific data:

1. Create `scripts/db/test-seed.sql`
2. Load it in your test setup:

```typescript
beforeAll(async () => {
  await db.query(fs.readFileSync('scripts/db/test-seed.sql', 'utf-8'));
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: monorepo_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install pnpm
        run: npm install -g pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm test:ci
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/monorepo_test
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### GitLab CI Example

```yaml
test:
  stage: test
  image: node:18-alpine
  services:
    - postgres:15-alpine
    - redis:7-alpine
  variables:
    POSTGRES_DB: monorepo_test
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/monorepo_test
    REDIS_URL: redis://redis:6379
  before_script:
    - npm install -g pnpm
    - pnpm install --frozen-lockfile
  script:
    - pnpm test:ci
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
```

## Best Practices

### 1. Write Descriptive Tests

```typescript
// Good
it('should return 400 when email is invalid', () => {
  // ...
});

// Bad
it('works', () => {
  // ...
});
```

### 2. Use Arrange-Act-Assert Pattern

```typescript
it('should calculate total price', () => {
  // Arrange
  const cart = new Cart();
  cart.addItem({ price: 10, quantity: 2 });

  // Act
  const total = cart.calculateTotal();

  // Assert
  expect(total).toBe(20);
});
```

### 3. Clean Up After Tests

```typescript
afterEach(() => {
  mockBot.clearSentMessages();
  redisClient.clear();
  jest.clearAllMocks();
});

afterAll(() => {
  jest.restoreAllMocks();
});
```

### 4. Don't Test Implementation Details

```typescript
// Good - Test behavior
it('should format user name correctly', () => {
  const result = formatUserName({ firstName: 'John', lastName: 'Doe' });
  expect(result).toBe('John Doe');
});

// Bad - Test implementation
it('should call toLowerCase and trim', () => {
  const spy = jest.spyOn(String.prototype, 'toLowerCase');
  formatUserName({ firstName: 'John', lastName: 'Doe' });
  expect(spy).toHaveBeenCalled();
});
```

### 5. Keep Tests Independent

```typescript
// Each test should be able to run in isolation
describe('User Service', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
  });

  it('test 1', () => {
    // Independent test
  });

  it('test 2', () => {
    // Independent test
  });
});
```

### 6. Use Meaningful Test Data

```typescript
// Good
const testUser = {
  id: '123',
  email: 'john.doe@example.com',
  name: 'John Doe',
};

// Bad
const testUser = {
  id: '1',
  email: 'a@b.c',
  name: 'x',
};
```

### 7. Test Edge Cases

```typescript
describe('divide', () => {
  it('should divide two numbers', () => {
    expect(divide(10, 2)).toBe(5);
  });

  it('should throw error when dividing by zero', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero');
  });

  it('should handle negative numbers', () => {
    expect(divide(-10, 2)).toBe(-5);
  });
});
```

### 8. Mock External Dependencies

```typescript
// Mock external API calls
jest.mock('axios');

it('should fetch user data', async () => {
  const mockData = { id: 1, name: 'John' };
  (axios.get as jest.Mock).mockResolvedValue({ data: mockData });

  const result = await fetchUser(1);
  expect(result).toEqual(mockData);
});
```

### 9. Use Test Fixtures

```typescript
// fixtures/users.ts
export const testUsers = {
  validUser: {
    id: '123',
    email: 'valid@example.com',
    name: 'Valid User',
  },
  adminUser: {
    id: '456',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin',
  },
};

// user.test.ts
import { testUsers } from '../fixtures/users';

it('should validate user permissions', () => {
  expect(hasPermission(testUsers.adminUser, 'delete')).toBe(true);
});
```

### 10. Parallel Test Execution

Tests run in parallel by default. For tests that need to run serially:

```typescript
// jest.config.js
module.exports = {
  maxWorkers: 1, // Run tests serially
};

// Or for specific test files
describe.serial('Serial tests', () => {
  // Tests that must run one at a time
});
```

## Troubleshooting

### Common Issues

#### Tests Hanging

```bash
# Add timeout to jest.config.js
testTimeout: 10000,
```

#### Module Resolution Errors

```bash
# Clear Jest cache
pnpm test --clearCache
```

#### Memory Issues

```bash
# Limit workers
pnpm test --maxWorkers=2
```

#### TypeScript Errors

```bash
# Ensure ts-jest is properly configured
# Check tsconfig.json includes test files
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [ts-jest Documentation](https://kulshekhar.github.io/ts-jest/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Use provided mocking utilities
3. Maintain or improve coverage
4. Write descriptive test names
5. Document complex test scenarios
6. Run tests locally before committing
7. Ensure CI passes before merging
