# Chat Module

AI chat clients with OpenRouter and Groq support, streaming capabilities, cost tracking, provider selection, and token accounting integration.

## Features

- **OpenRouter Client**: Access to multiple LLM models through OpenRouter's unified API
- **Groq Client**: Fast LLM inference with Groq
- **Streaming Support**: Real-time streaming responses for better UX
- **Cost Tracking**: Automatic cost estimation per provider and model
- **Provider Selection**: Smart provider selection based on availability, cost, or custom strategies
- **Content Moderation**: Built-in content filtering for safety
- **Token Accounting**: Integrated with token service for automatic token deduction
- **Message Logging**: Automatic logging of all chat messages to database
- **Conversation History**: Track and retrieve conversation context

## Installation

The chat module is part of the `@monorepo/shared` package:

```bash
pnpm install @monorepo/shared
```

## Quick Start

```typescript
import { 
  ChatService, 
  OpenRouterClient, 
  GroqClient,
  SelectionStrategy 
} from '@monorepo/shared';
import { db } from '@monorepo/database';

// Initialize clients
const openrouterClient = new OpenRouterClient({
  apiKey: process.env.OPENROUTER_API_KEY,
  siteName: 'My App',
  siteUrl: 'https://myapp.com',
});

const groqClient = new GroqClient({
  apiKey: process.env.GROQ_API_KEY,
});

// Create chat service
const chatService = new ChatService(
  db,
  [openrouterClient, groqClient],
  {
    moderationEnabled: true,
    defaultModel: 'llama-3.1-8b-instant',
    maxConversationHistory: 50,
  }
);

// Create a chat completion
const result = await chatService.createCompletion(
  userId,
  [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello! How are you?' },
  ],
  {
    strategy: SelectionStrategy.LOWEST_COST,
    model: 'llama-3.1-8b-instant',
  }
);

console.log(result.response.content);
console.log('Tokens deducted:', result.tokensDeducted);
console.log('New balance:', result.newBalance);
```

## Streaming Example

```typescript
// Create a streaming completion
const generator = chatService.createStreamingCompletion(
  userId,
  [
    { role: 'user', content: 'Tell me a story' },
  ],
  {
    strategy: SelectionStrategy.HIGHEST_PRIORITY,
  }
);

// Stream chunks to the client
for await (const chunk of generator) {
  process.stdout.write(chunk.delta);
  
  if (chunk.finishReason) {
    console.log('\nFinish reason:', chunk.finishReason);
  }
}
```

## Provider Selection Strategies

The chat service supports three provider selection strategies:

### Lowest Cost
```typescript
{
  strategy: SelectionStrategy.LOWEST_COST,
  model: 'llama-3.1-8b-instant',
}
```

Selects the provider with the lowest estimated cost for the given model.

### Highest Priority
```typescript
{
  strategy: SelectionStrategy.HIGHEST_PRIORITY,
}
```

Selects providers in priority order: Groq > OpenRouter.

### Round Robin
```typescript
{
  strategy: SelectionStrategy.ROUND_ROBIN,
}
```

Distributes requests evenly across all available providers.

## Content Moderation

The chat service includes built-in content moderation to filter inappropriate content:

```typescript
// Enable moderation (default)
const chatService = new ChatService(db, clients, {
  moderationEnabled: true,
});

// Disable moderation
const chatService = new ChatService(db, clients, {
  moderationEnabled: false,
});
```

The moderation service checks for:
- Hate speech
- Violence
- Sexual content
- Self-harm content

Messages flagged by moderation will throw an error before being sent to the AI provider.

## Conversation History

Retrieve conversation history for context:

```typescript
const history = await chatService.getConversationHistory(
  userId,
  conversationId,
  50  // limit
);

// Use history in next completion
const result = await chatService.createCompletion(
  userId,
  [
    ...history,
    { role: 'user', content: 'Continue our conversation' },
  ]
);
```

## Provider Health Monitoring

Check the health status of all providers:

```typescript
const healthStatus = await chatService.getProviderHealth();

healthStatus.forEach((health) => {
  console.log(`${health.provider}: ${health.available ? 'UP' : 'DOWN'}`);
  console.log(`  Latency: ${health.latency}ms`);
  if (health.error) {
    console.log(`  Error: ${health.error}`);
  }
});
```

## Token Accounting Integration

The chat service automatically:
1. Checks if user has sufficient tokens before making requests
2. Deducts tokens after completion (5 tokens per message by default)
3. Updates user balance in database
4. Creates audit log entries in `token_operations` table
5. Logs messages to `chat_messages` table

Token costs can be customized in the token service configuration.

## Cost Tracking

Each completion returns cost information:

```typescript
const result = await chatService.createCompletion(userId, messages);

if (result.response.cost) {
  console.log(`Cost: $${result.response.cost.toFixed(6)}`);
}

if (result.response.usage) {
  console.log('Token usage:', {
    prompt: result.response.usage.promptTokens,
    completion: result.response.usage.completionTokens,
    total: result.response.usage.totalTokens,
  });
}
```

## OpenRouter Client

Direct usage of OpenRouter client:

```typescript
import { OpenRouterClient } from '@monorepo/shared';

const client = new OpenRouterClient({
  apiKey: process.env.OPENROUTER_API_KEY,
  siteName: 'My App',
  siteUrl: 'https://myapp.com',
});

// Check availability
const available = await client.isAvailable();

// Create completion
const response = await client.createCompletion({
  model: 'openai/gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 0.7,
  maxTokens: 1000,
});

// Estimate cost
const cost = client.estimateCost('openai/gpt-3.5-turbo', 1000, 500);
```

## Groq Client

Direct usage of Groq client:

```typescript
import { GroqClient } from '@monorepo/shared';

const client = new GroqClient({
  apiKey: process.env.GROQ_API_KEY,
});

// Check availability
const available = await client.isAvailable();

// Create completion
const response = await client.createCompletion({
  model: 'llama-3.1-8b-instant',
  messages: [{ role: 'user', content: 'Hello' }],
  temperature: 0.7,
  maxTokens: 1000,
  user: 'user-123',
});

// Stream completion
for await (const chunk of client.createStreamingCompletion({
  model: 'llama-3.1-8b-instant',
  messages: [{ role: 'user', content: 'Hello' }],
})) {
  console.log(chunk.delta);
}
```

## Supported Models

### OpenRouter
- `openai/gpt-4-turbo`
- `openai/gpt-3.5-turbo`
- `anthropic/claude-3-opus`
- `anthropic/claude-3-sonnet`
- `meta-llama/llama-3.1-70b-instruct`
- And many more...

### Groq
- `llama-3.1-405b-reasoning`
- `llama-3.1-70b-versatile`
- `llama-3.1-8b-instant`
- `llama3-groq-70b-8192-tool-use-preview`
- `llama3-groq-8b-8192-tool-use-preview`
- `mixtral-8x7b-32768`
- `gemma2-9b-it`

## Error Handling

The chat service throws errors for:
- Insufficient tokens
- Flagged content (moderation)
- API errors from providers
- Network failures
- Invalid configurations

Always wrap calls in try-catch blocks:

```typescript
try {
  const result = await chatService.createCompletion(userId, messages);
  // Handle success
} catch (error) {
  if (error.message.includes('Insufficient tokens')) {
    // Handle insufficient tokens
  } else if (error.message.includes('flagged')) {
    // Handle moderation flag
  } else {
    // Handle other errors
  }
}
```

## Environment Variables

Required environment variables:

```bash
# OpenRouter
OPENROUTER_API_KEY=your_openrouter_api_key

# Groq
GROQ_API_KEY=your_groq_api_key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

## Testing

The chat module includes comprehensive unit tests:

```bash
# Run all chat tests
pnpm test chat

# Run specific test file
pnpm test openrouter-client
pnpm test groq-client
pnpm test provider-selector
pnpm test moderation-service
pnpm test chat-service
```

Test coverage:
- ✅ OpenRouter client: 18 tests
- ✅ Groq client: 22 tests
- ✅ Provider selector: 16 tests
- ✅ Moderation service: 7 tests
- ✅ Chat service: 15 tests

Total: **78 passing tests** with full coverage of:
- HTTP request handling
- Streaming responses
- Error scenarios
- Cost estimation
- Provider selection
- Content moderation
- Token accounting
- Message logging

## Architecture

```
chat/
├── clients/
│   ├── openrouter-client.ts    # OpenRouter API wrapper
│   └── groq-client.ts           # Groq API wrapper
├── providers/
│   ├── provider-selector.ts     # Smart provider selection
│   └── moderation-service.ts    # Content moderation
├── chat-service.ts              # Main chat service
├── types.ts                     # TypeScript types
├── index.ts                     # Public exports
└── __tests__/                   # Unit tests
```

## Best Practices

1. **Always use ChatService**: Don't use clients directly unless you have a specific reason
2. **Enable moderation**: Keep moderation enabled for user-facing applications
3. **Handle errors**: Always wrap calls in try-catch blocks
4. **Monitor costs**: Track usage and costs with the built-in cost tracking
5. **Use conversation history**: Maintain context for better responses
6. **Check provider health**: Monitor provider availability and latency
7. **Configure token costs**: Adjust token costs based on your pricing model
8. **Cache conversation history**: Retrieve history once and reuse it

## License

Private monorepo package - not for public distribution.
