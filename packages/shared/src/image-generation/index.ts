// Types - Export individual types to avoid conflicts with chat module
export type {
  IImageClient,
  ImageGenerationRequest,
  ImageGenerationResponse,
  JobPollResult,
  FailoverResult,
  CostTracking,
  ImageGenerationServiceOptions,
} from './types';

export {
  ImageProvider,
  JobStatus,
  SelectionStrategy as ImageSelectionStrategy,
} from './types';

// Re-export types with aliases to avoid conflicts
export type { ProviderConfig as ImageProviderConfig } from './types';
export type { ProviderHealth as ImageProviderHealth } from './types';
export type { ProviderSelectionOptions as ImageProviderSelectionOptions } from './types';
export type { ModerationResult as ImageModerationResult } from './types';

// Clients
export { FalClient } from './clients/fal-client';
export { TogetherClient } from './clients/together-client';
export { ReplicateClient } from './clients/replicate-client';

// Providers - Export with aliases to avoid conflicts
export { ProviderSelector as ImageProviderSelector } from './providers/provider-selector';
export { ModerationService as ImageModerationService } from './providers/moderation-service';

// Main Service
export { ImageGenerationService } from './image-generation-service';
