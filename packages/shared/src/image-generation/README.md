# Image Generation Module

Unified abstraction layer for multiple image generation providers (fal.ai, Together.ai, Replicate) with automatic failover, cost tracking, job polling, and content moderation.

## Features

- **Multi-Provider Support**: fal.ai, Together.ai, and Replicate with unified interface
- **Automatic Failover**: Seamlessly switch between providers on failure
- **Cost Tracking**: Monitor costs across all providers and models
- **Job Polling**: Handle long-running async generation jobs
- **Content Moderation**: Pre-check prompts for inappropriate content (nudity, alcohol, logos, violence)
- **Smart Provider Selection**: Lowest cost, highest priority, round-robin, or failover strategies
- **Retry Logic**: Automatic retries with exponential backoff
- **Health Monitoring**: Track provider availability and latency

## Installation

The image generation module is part of the `@monorepo/shared` package:

```bash
pnpm install @monorepo/shared
```

## Quick Start

```typescript
import {
  ImageGenerationService,
  ProviderSelector,
  FalClient,
  TogetherClient,
  ReplicateClient,
  ImageProvider,
  SelectionStrategy,
} from '@monorepo/shared';

// Initialize clients
const falClient = new FalClient({
  apiKey: process.env.FAL_API_KEY,
});

const togetherClient = new TogetherClient({
  apiKey: process.env.TOGETHER_API_KEY,
});

const replicateClient = new ReplicateClient({
  apiKey: process.env.REPLICATE_API_KEY,
});

// Configure providers
const configs = [
  {
    provider: ImageProvider.FAL,
    apiKey: process.env.FAL_API_KEY,
    enabled: true,
    priority: 1,
    models: ['fal-ai/flux/schnell', 'fal-ai/flux/dev'],
  },
  {
    provider: ImageProvider.TOGETHER,
    apiKey: process.env.TOGETHER_API_KEY,
    enabled: true,
    priority: 2,
    models: ['black-forest-labs/FLUX.1-schnell'],
  },
  {
    provider: ImageProvider.REPLICATE,
    apiKey: process.env.REPLICATE_API_KEY,
    enabled: true,
    priority: 3,
    models: ['*'], // Supports all models
  },
];

// Create provider selector
const providerSelector = new ProviderSelector(
  [falClient, togetherClient, replicateClient],
  configs,
);

// Create image generation service
const imageService = new ImageGenerationService(providerSelector, {
  moderationEnabled: true,
  maxRetries: 3,
  retryDelayMs: 1000,
});

// Generate an image
const response = await imageService.generateImage({
  prompt: 'A beautiful sunset over mountains',
  model: 'fal-ai/flux/schnell',
  width: 1024,
  height: 1024,
  numImages: 1,
});

console.log('Generated image:', response.images[0].url);
console.log('Cost:', response.cost);
console.log('Provider:', response.provider);
```

## Provider Selection Strategies

### Failover (Default)
Tries providers in priority order until one succeeds:

```typescript
const response = await imageService.generateImage(
  {
    prompt: 'A cat',
    model: 'fal-ai/flux/schnell',
  },
  {
    strategy: SelectionStrategy.FAILOVER,
  },
);
```

### Lowest Cost
Selects the provider with the lowest estimated cost:

```typescript
const response = await imageService.generateImage(
  {
    prompt: 'A cat',
    model: 'fal-ai/flux/schnell',
  },
  {
    strategy: SelectionStrategy.LOWEST_COST,
  },
);
```

### Highest Priority
Selects the provider with the highest priority:

```typescript
const response = await imageService.generateImage(
  {
    prompt: 'A cat',
    model: 'fal-ai/flux/schnell',
  },
  {
    strategy: SelectionStrategy.HIGHEST_PRIORITY,
  },
);
```

### Round Robin
Distributes requests evenly across all providers:

```typescript
const response = await imageService.generateImage(
  {
    prompt: 'A cat',
    model: 'fal-ai/flux/schnell',
  },
  {
    strategy: SelectionStrategy.ROUND_ROBIN,
  },
);
```

## Content Moderation

The service includes built-in content moderation that checks prompts for inappropriate content:

```typescript
// Enable moderation (default)
const service = new ImageGenerationService(providerSelector, {
  moderationEnabled: true,
});

// This will throw an error
try {
  await service.generateImage({
    prompt: 'nude explicit content',
    model: 'test-model',
  });
} catch (error) {
  console.error('Blocked:', error.message);
  // "Content moderation flagged: nude, explicit"
}

// Disable moderation if needed
const noModService = new ImageGenerationService(providerSelector, {
  moderationEnabled: false,
});
```

### Moderation Categories

- **Nudity**: nude, naked, nsfw, explicit, etc.
- **Alcohol**: alcohol, beer, wine, drinking, etc.
- **Logos**: brand names, trademarks, logos
- **Violence**: violent, weapon, blood, gore, etc.

### Custom Moderation Keywords

```typescript
const moderationService = imageService.getModerationService();

// Add custom keywords
moderationService.addKeywords('nudity', ['custom-nsfw-term']);
moderationService.addKeywords('alcohol', ['custom-drink']);
moderationService.addKeywords('logos', ['custom-brand']);
moderationService.addKeywords('violence', ['custom-violent-term']);
```

## Cost Tracking

Track costs across all providers:

```typescript
// Generate some images
await imageService.generateImage({ prompt: 'test 1', model: 'model-1' });
await imageService.generateImage({ prompt: 'test 2', model: 'model-2' });

// Get cost tracking history
const costs = imageService.getCostTracking();
costs.forEach((cost) => {
  console.log(`${cost.provider}: $${cost.cost} - ${cost.successful ? 'Success' : 'Failed'}`);
});

// Get total cost
const totalCost = imageService.getTotalCost();
console.log('Total cost:', totalCost);

// Clear cost history
imageService.clearCostTracking();
```

## Provider Health Monitoring

Check the health status of all providers:

```typescript
const health = await imageService.getProviderHealth();

health.forEach((h) => {
  console.log(`${h.provider}: ${h.available ? 'UP' : 'DOWN'}`);
  if (h.latency) {
    console.log(`  Latency: ${h.latency}ms`);
  }
  if (h.error) {
    console.log(`  Error: ${h.error}`);
  }
});
```

## Direct Provider Usage

Use a specific provider without failover:

```typescript
// Generate with fal.ai only
const response = await imageService.generateImageWithProvider(
  ImageProvider.FAL,
  {
    prompt: 'A sunset',
    model: 'fal-ai/flux/schnell',
  },
);

console.log('Generated with:', response.provider);
```

## Individual Client Usage

### fal.ai Client

```typescript
import { FalClient } from '@monorepo/shared';

const client = new FalClient({
  apiKey: process.env.FAL_API_KEY,
  timeoutMs: 300000, // 5 minutes
});

// Check availability
const available = await client.isAvailable();

// Generate image
const response = await client.generateImage({
  prompt: 'A beautiful landscape',
  model: 'fal-ai/flux/schnell',
  width: 1024,
  height: 1024,
});

// Poll job status
const status = await client.pollJob('job-id');

// Estimate cost
const cost = client.estimateCost('fal-ai/flux/schnell', 1024, 1024, 1);
```

### Together.ai Client

```typescript
import { TogetherClient } from '@monorepo/shared';

const client = new TogetherClient({
  apiKey: process.env.TOGETHER_API_KEY,
});

const response = await client.generateImage({
  prompt: 'A beautiful landscape',
  model: 'black-forest-labs/FLUX.1-schnell',
  width: 1024,
  height: 1024,
});
```

### Replicate Client

```typescript
import { ReplicateClient } from '@monorepo/shared';

const client = new ReplicateClient({
  apiKey: process.env.REPLICATE_API_KEY,
});

const response = await client.generateImage({
  prompt: 'A beautiful landscape',
  model: 'stability-ai/sdxl:latest',
  width: 1024,
  height: 1024,
});
```

## Advanced Options

### Request Options

```typescript
const response = await imageService.generateImage({
  prompt: 'A beautiful sunset',
  model: 'fal-ai/flux/schnell',
  width: 1024,
  height: 1024,
  numImages: 2,
  guidanceScale: 7.5,
  numInferenceSteps: 50,
  seed: 12345,
  negativePrompt: 'blurry, low quality',
});
```

### Service Options

```typescript
const service = new ImageGenerationService(providerSelector, {
  moderationEnabled: true,
  maxRetries: 5, // Retry up to 5 times
  retryDelayMs: 2000, // Wait 2 seconds between retries
  pollIntervalMs: 5000, // Poll every 5 seconds
  maxPollAttempts: 60, // Max 60 poll attempts (5 minutes)
});
```

## Error Handling

```typescript
try {
  const response = await imageService.generateImage({
    prompt: 'test',
    model: 'test-model',
  });
} catch (error) {
  if (error.message.includes('moderation flagged')) {
    // Handle moderation error
  } else if (error.message.includes('All providers failed')) {
    // Handle all providers failing
  } else if (error.message.includes('No providers available')) {
    // Handle no providers configured
  } else {
    // Handle other errors
  }
}
```

## Testing

The module includes comprehensive tests with mock providers:

```typescript
import {
  MockFalClient,
  MockTogetherClient,
  MockReplicateClient,
  createMockImageResponse,
} from '@monorepo/test-utils';

const mockClient = new MockFalClient();

// Set mock response
mockClient.setMockResponse(
  createMockImageResponse({
    provider: ImageProvider.FAL,
    images: [{ url: 'https://test.com/image.png' }],
  }),
);

// Simulate failure
mockClient.setShouldFail(true);

// Simulate unavailable
mockClient.setAvailabilityStatus(false);

// Check calls
const calls = mockClient.getCalls();
expect(calls).toHaveLength(1);

// Reset mock
mockClient.reset();
```

## Environment Variables

```bash
# Provider API Keys
FAL_API_KEY=your_fal_api_key
TOGETHER_API_KEY=your_together_api_key
REPLICATE_API_KEY=your_replicate_api_key
```

## Supported Models

### fal.ai
- `fal-ai/flux/schnell` - Fast FLUX model
- `fal-ai/flux/dev` - FLUX development model
- `fal-ai/flux-pro` - FLUX pro model
- `fal-ai/stable-diffusion-xl` - Stable Diffusion XL
- `fal-ai/stable-diffusion-v3-medium` - SD3 medium

### Together.ai
- `black-forest-labs/FLUX.1-schnell` - Fast FLUX
- `black-forest-labs/FLUX.1-dev` - FLUX dev
- `stabilityai/stable-diffusion-xl-base-1.0` - SDXL
- `stabilityai/stable-diffusion-2-1` - SD 2.1
- `runwayml/stable-diffusion-v1-5` - SD 1.5

### Replicate
- Supports all models via version hash or owner/name format
- Use `*` in provider config to support all models

## Architecture

```
image-generation/
├── clients/
│   ├── fal-client.ts          # fal.ai API wrapper
│   ├── together-client.ts     # Together.ai API wrapper
│   └── replicate-client.ts    # Replicate API wrapper
├── providers/
│   ├── provider-selector.ts   # Smart provider selection
│   └── moderation-service.ts  # Content moderation
├── image-generation-service.ts # Main service
├── types.ts                   # TypeScript types
├── index.ts                   # Public exports
└── __tests__/                 # Unit tests
```

## Best Practices

1. **Always use ImageGenerationService**: Don't use clients directly unless you need specific provider features
2. **Enable moderation**: Keep moderation enabled for user-facing applications
3. **Configure failover order**: Set priorities based on cost, reliability, and performance
4. **Monitor costs**: Use cost tracking to optimize provider selection
5. **Handle errors gracefully**: Wrap calls in try-catch blocks
6. **Check provider health**: Monitor provider availability and latency
7. **Use appropriate retry settings**: Balance between reliability and response time
8. **Cache responses**: Store generated images to avoid redundant generations

## License

Private monorepo package - not for public distribution.
