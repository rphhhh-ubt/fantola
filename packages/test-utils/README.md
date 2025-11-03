# @monorepo/test-utils

Test utilities and mocks for the monorepo, providing comprehensive mocking capabilities for external services, AI providers, and testing helpers.

## Installation

This package is internal to the monorepo and is automatically available to all services and packages through workspace dependencies.

```json
{
  "devDependencies": {
    "@monorepo/test-utils": "workspace:*"
  }
}
```

## Usage

```typescript
import {
  MockTelegramBot,
  MockOpenAIClient,
  MockRedisClient,
  mockConsole,
} from '@monorepo/test-utils';
```

## API Reference

### Telegram Mocks

#### MockTelegramBot

Mock implementation of a Telegram bot client.

```typescript
const mockBot = new MockTelegramBot();

// Send message
await mockBot.sendMessage(12345, 'Hello');

// Get sent messages
const messages = mockBot.getSentMessages();

// Clear history
mockBot.clearSentMessages();
```

#### Factory Functions

```typescript
// Create mock update
const update = createMockTelegramUpdate({
  message: {
    text: 'Custom message',
  },
});

// Create mock message
const message = createMockTelegramMessage({
  text: 'Test message',
  chat: { id: 12345, type: 'private' },
});
```

### AI Provider Mocks

#### MockOpenAIClient

Mock implementation of OpenAI client.

```typescript
const openai = new MockOpenAIClient();

// Use default response
const response = await openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Hello' }],
});

// Set custom response
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

// Track calls
const calls = openai.getCalls();
```

#### MockAnthropicClient

Mock implementation of Anthropic client.

```typescript
const anthropic = new MockAnthropicClient();

const response = await anthropic.messages.create({
  model: 'claude-3-opus-20240229',
  messages: [{ role: 'user', content: 'Hello' }],
  max_tokens: 1024,
});
```

### External Service Mocks

#### MockRedisClient

In-memory Redis client mock.

```typescript
const redis = new MockRedisClient();

// Basic operations
await redis.set('key', 'value');
const value = await redis.get('key');
await redis.del('key');

// Expiration
await redis.set('key', 'value', { EX: 60 });
await redis.expire('key', 120);
const ttl = await redis.ttl('key');

// Clear all data
redis.clear();
```

#### MockDatabaseClient

Mock PostgreSQL client.

```typescript
const db = new MockDatabaseClient();

// Execute queries
const result = await db.query('SELECT * FROM users WHERE id = $1', [1]);

// Track queries
const queries = db.getQueries();

// Set mock data
db.setMockData('users', [{ id: 1, name: 'John' }]);

// Clear all data
db.clear();
```

#### MockS3Client

Mock S3 client.

```typescript
const s3 = new MockS3Client();

// Put object
await s3.putObject({
  Bucket: 'bucket',
  Key: 'key',
  Body: 'content',
});

// Get object
const obj = await s3.getObject({
  Bucket: 'bucket',
  Key: 'key',
});

// Delete object
await s3.deleteObject({
  Bucket: 'bucket',
  Key: 'key',
});

// List objects
const list = await s3.listObjectsV2({
  Bucket: 'bucket',
  Prefix: 'prefix/',
});

// Clear all data
s3.clear();
```

### Test Helpers

#### waitFor

Wait for a specified time.

```typescript
await waitFor(1000); // Wait 1 second
```

#### mockDateNow

Mock Date.now() to return a specific timestamp.

```typescript
const spy = mockDateNow(1234567890);

// Later, restore
spy.mockRestore();
```

#### mockConsole

Mock console methods.

```typescript
const consoleMock = mockConsole();

console.log('test');
expect(consoleMock.log).toHaveBeenCalledWith('test');

// Restore all
consoleMock.log.mockRestore();
consoleMock.error.mockRestore();
```

#### createMockEnv / cleanupMockEnv

Manage environment variables in tests.

```typescript
createMockEnv({
  NODE_ENV: 'test',
  DATABASE_URL: 'test-db',
});

// Later, clean up
cleanupMockEnv(['NODE_ENV', 'DATABASE_URL']);
```

#### expectToThrow

Assert that a function throws an error.

```typescript
await expectToThrow(
  async () => {
    throw new Error('Test error');
  },
  'Test error'
);
```

#### createSpy

Create a spy function.

```typescript
const spy = createSpy((arg: string) => `result: ${arg}`);

spy('test');
expect(spy).toHaveBeenCalledWith('test');
```

#### createSpyObj

Create an object with multiple spy methods.

```typescript
interface Service {
  method1: () => void;
  method2: (arg: string) => string;
}

const mockService = createSpyObj<Service>('Service', ['method1', 'method2']);

mockService.method1();
expect(mockService.method1).toHaveBeenCalled();
```

## Best Practices

1. **Always clear mocks between tests**

   ```typescript
   afterEach(() => {
     mockBot.clearSentMessages();
     redisClient.clear();
     jest.clearAllMocks();
   });
   ```

2. **Use factory functions for consistent test data**

   ```typescript
   const update = createMockTelegramUpdate();
   ```

3. **Set up mocks in beforeEach**

   ```typescript
   beforeEach(() => {
     mockBot = new MockTelegramBot();
   });
   ```

4. **Verify mock interactions**
   ```typescript
   await mockBot.sendMessage(12345, 'Hello');
   expect(mockBot.getSentMessages()).toHaveLength(1);
   ```

## Contributing

When adding new mocks:

1. Follow the existing patterns
2. Include factory functions for common scenarios
3. Provide clear methods
4. Add TypeScript types
5. Document the API
