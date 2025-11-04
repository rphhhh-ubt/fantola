import { EventEmitter } from 'events';
import { GenerationStatus } from '@monorepo/database';

/**
 * Generation event types
 */
export enum GenerationEventType {
  QUEUED = 'generation:queued',
  PROCESSING = 'generation:processing',
  COMPLETED = 'generation:completed',
  FAILED = 'generation:failed',
  CANCELED = 'generation:canceled',
}

/**
 * Generation type for events
 */
export enum GenerationType {
  PRODUCT_CARD = 'product_card',
  SORA = 'sora',
  CHAT = 'chat',
}

/**
 * Generation event payload
 */
export interface GenerationEventPayload {
  generationId: string;
  userId: string;
  type: GenerationType;
  status: GenerationStatus;
  timestamp: number;
  metadata?: {
    tool?: string;
    prompt?: string;
    resultUrls?: string[];
    errorMessage?: string;
    tokensUsed?: number;
    [key: string]: unknown;
  };
}

/**
 * Event emitter for generation lifecycle events
 * This can be integrated with WebSocket server or other notification systems
 */
class GenerationEventEmitter extends EventEmitter {
  /**
   * Emit a generation event
   */
  emitGenerationEvent(event: GenerationEventType, payload: GenerationEventPayload): void {
    this.emit(event, payload);
    // Also emit a generic 'generation:*' event
    this.emit('generation:*', { event, payload });
  }

  /**
   * Subscribe to generation events for a specific user
   */
  onUserEvent(
    userId: string,
    callback: (event: GenerationEventType, payload: GenerationEventPayload) => void,
  ): void {
    this.on('generation:*', ({ event, payload }: { event: GenerationEventType; payload: GenerationEventPayload }) => {
      if (payload.userId === userId) {
        callback(event, payload);
      }
    });
  }

  /**
   * Subscribe to all generation events
   */
  onAllEvents(
    callback: (event: GenerationEventType, payload: GenerationEventPayload) => void,
  ): void {
    this.on('generation:*', ({ event, payload }: { event: GenerationEventType; payload: GenerationEventPayload }) => {
      callback(event, payload);
    });
  }
}

/**
 * Global event emitter instance
 */
export const generationEvents = new GenerationEventEmitter();

/**
 * Helper to emit queued event
 */
export function emitQueuedEvent(payload: Omit<GenerationEventPayload, 'status' | 'timestamp'>): void {
  generationEvents.emitGenerationEvent(GenerationEventType.QUEUED, {
    ...payload,
    status: GenerationStatus.pending,
    timestamp: Date.now(),
  });
}

/**
 * Helper to emit processing event
 */
export function emitProcessingEvent(payload: Omit<GenerationEventPayload, 'status' | 'timestamp'>): void {
  generationEvents.emitGenerationEvent(GenerationEventType.PROCESSING, {
    ...payload,
    status: GenerationStatus.processing,
    timestamp: Date.now(),
  });
}

/**
 * Helper to emit completed event
 */
export function emitCompletedEvent(payload: Omit<GenerationEventPayload, 'status' | 'timestamp'>): void {
  generationEvents.emitGenerationEvent(GenerationEventType.COMPLETED, {
    ...payload,
    status: GenerationStatus.completed,
    timestamp: Date.now(),
  });
}

/**
 * Helper to emit failed event
 */
export function emitFailedEvent(payload: Omit<GenerationEventPayload, 'status' | 'timestamp'>): void {
  generationEvents.emitGenerationEvent(GenerationEventType.FAILED, {
    ...payload,
    status: GenerationStatus.failed,
    timestamp: Date.now(),
  });
}

/**
 * Helper to emit canceled event
 */
export function emitCanceledEvent(payload: Omit<GenerationEventPayload, 'status' | 'timestamp'>): void {
  generationEvents.emitGenerationEvent(GenerationEventType.CANCELED, {
    ...payload,
    status: GenerationStatus.canceled,
    timestamp: Date.now(),
  });
}
