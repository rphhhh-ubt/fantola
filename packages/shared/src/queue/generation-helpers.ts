import type { PrismaClient } from '@monorepo/database';
import { GenerationStatus, GenerationTool } from '@monorepo/database';
import { QueueProducer } from './producer';
import {
  ProductCardGenerationJobData,
  SoraGenerationJobData,
  ChatProcessingJobData,
  ExtendedJobOptions,
} from './types';
import { getTierPriority } from './config';
import { emitQueuedEvent, GenerationType } from './events';

/**
 * Options for creating a product card generation job
 */
export interface CreateProductCardJobOptions {
  userId: string;
  userTier: string;
  productImageUrl: string;
  productImageKey: string;
  mode: string;
  background?: string;
  pose?: string;
  textHeadline?: string;
  textSubheadline?: string;
  textDescription?: string;
  tokensUsed?: number;
  parentGenerationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Options for creating a Sora generation job
 */
export interface CreateSoraJobOptions {
  userId: string;
  userTier: string;
  prompt: string;
  imageUrls: string[];
  tokensUsed?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Options for creating a chat processing job
 */
export interface CreateChatJobOptions {
  userId: string;
  userTier: string;
  message: string;
  conversationId?: string;
  model?: string;
  tokensUsed?: number;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Result from creating a generation job
 */
export interface CreateJobResult {
  generationId: string;
  jobId: string;
  status: GenerationStatus;
}

/**
 * Create a product card generation job
 * This will:
 * 1. Create a ProductCardGeneration record in database with 'pending' status
 * 2. Queue the job in BullMQ with tier-based priority
 * 3. Emit a WebSocket event for real-time updates
 */
export async function createProductCardJob(
  db: PrismaClient,
  queueProducer: QueueProducer<ProductCardGenerationJobData>,
  options: CreateProductCardJobOptions
): Promise<CreateJobResult> {
  const {
    userId,
    userTier,
    productImageUrl,
    productImageKey,
    mode,
    background,
    pose,
    textHeadline,
    textSubheadline,
    textDescription,
    tokensUsed = 10,
    parentGenerationId,
    metadata,
  } = options;

  // Create database record
  const generation = await db.productCardGeneration.create({
    data: {
      userId,
      status: GenerationStatus.pending,
      productImageUrl,
      productImageKey,
      mode,
      background,
      pose,
      textHeadline,
      textSubheadline,
      textDescription,
      tokensUsed,
      parentGenerationId,
      metadata: metadata as any,
    },
  });

  // Get priority based on user tier
  const priority = getTierPriority(userTier);

  // Queue the job with tier-based priority
  const jobOptions: ExtendedJobOptions = {
    priority,
    jobId: generation.id,
  };

  const job = await queueProducer.addJob(
    'product-card-generation',
    {
      generationId: generation.id,
      userId,
      productImageUrl,
      options: {
        mode,
        background,
        pose,
        textHeadline,
        textSubheadline,
        textDescription,
      },
      timestamp: Date.now(),
      metadata,
    },
    jobOptions
  );

  // Emit WebSocket event
  emitQueuedEvent({
    generationId: generation.id,
    userId,
    type: GenerationType.PRODUCT_CARD,
    metadata: {
      tool: 'product_card',
      mode,
      tokensUsed,
    },
  });

  return {
    generationId: generation.id,
    jobId: job.id || generation.id,
    status: GenerationStatus.pending,
  };
}

/**
 * Create a Sora image generation job
 * This will:
 * 1. Create a SoraGeneration record in database with 'pending' status
 * 2. Queue the job in BullMQ with tier-based priority
 * 3. Emit a WebSocket event for real-time updates
 */
export async function createSoraJob(
  db: PrismaClient,
  queueProducer: QueueProducer<SoraGenerationJobData>,
  options: CreateSoraJobOptions
): Promise<CreateJobResult> {
  const { userId, userTier, prompt, imageUrls, tokensUsed = 10, metadata } = options;

  // Create database record
  const generation = await db.soraGeneration.create({
    data: {
      userId,
      status: GenerationStatus.pending,
      prompt,
      tokensUsed,
      metadata: metadata as any,
    },
  });

  // Get priority based on user tier
  const priority = getTierPriority(userTier);

  // Queue the job with tier-based priority
  const jobOptions: ExtendedJobOptions = {
    priority,
    jobId: generation.id,
  };

  const job = await queueProducer.addJob(
    'sora-generation',
    {
      generationId: generation.id,
      userId,
      prompt,
      imageUrls,
      timestamp: Date.now(),
      metadata,
    },
    jobOptions
  );

  // Emit WebSocket event
  emitQueuedEvent({
    generationId: generation.id,
    userId,
    type: GenerationType.SORA,
    metadata: {
      tool: 'sora',
      prompt,
      imageCount: imageUrls.length,
      tokensUsed,
    },
  });

  return {
    generationId: generation.id,
    jobId: job.id || generation.id,
    status: GenerationStatus.pending,
  };
}

/**
 * Create a chat processing job (for async chat processing)
 * This will:
 * 1. Create a Generation record in database with 'pending' status
 * 2. Queue the job in BullMQ with tier-based priority
 * 3. Emit a WebSocket event for real-time updates
 */
export async function createChatJob(
  db: PrismaClient,
  queueProducer: QueueProducer<ChatProcessingJobData>,
  options: CreateChatJobOptions
): Promise<CreateJobResult> {
  const {
    userId,
    userTier,
    message,
    conversationId,
    model = 'gpt-4',
    tokensUsed = 5,
    temperature,
    maxTokens,
    stream = false,
    metadata,
  } = options;

  // Create database record
  const generation = await db.generation.create({
    data: {
      userId,
      tool: GenerationTool.chatgpt,
      status: GenerationStatus.pending,
      prompt: message,
      model,
      tokensUsed,
      resultUrls: [],
      metadata: {
        ...metadata,
        conversationId,
        temperature,
        maxTokens,
        stream,
      } as any,
    },
  });

  // Get priority based on user tier
  const priority = getTierPriority(userTier);

  // Queue the job with tier-based priority
  const jobOptions: ExtendedJobOptions = {
    priority,
    jobId: generation.id,
  };

  const job = await queueProducer.addJob(
    'chat-processing',
    {
      userId,
      message,
      conversationId,
      model,
      timestamp: Date.now(),
      options: {
        temperature,
        maxTokens,
        stream,
      },
      metadata,
    },
    jobOptions
  );

  // Emit WebSocket event
  emitQueuedEvent({
    generationId: generation.id,
    userId,
    type: GenerationType.CHAT,
    metadata: {
      tool: 'chatgpt',
      model,
      conversationId,
      tokensUsed,
    },
  });

  return {
    generationId: generation.id,
    jobId: job.id || generation.id,
    status: GenerationStatus.pending,
  };
}

/**
 * Update generation status and emit event
 */
export async function updateGenerationStatus(
  db: PrismaClient,
  generationId: string,
  userId: string,
  type: GenerationType,
  status: GenerationStatus,
  metadata?: {
    resultUrls?: string[];
    errorMessage?: string;
    tokensUsed?: number;
    [key: string]: unknown;
  }
): Promise<void> {
  const updateData: any = {
    status,
    updatedAt: new Date(),
  };

  if (status === GenerationStatus.processing) {
    updateData.startedAt = new Date();
  } else if (status === GenerationStatus.completed || status === GenerationStatus.failed) {
    updateData.completedAt = new Date();
  }

  if (metadata?.resultUrls) {
    updateData.resultUrls = metadata.resultUrls;
  }

  if (metadata?.errorMessage) {
    updateData.errorMessage = metadata.errorMessage;
  }

  // Update the appropriate table based on type
  if (type === GenerationType.PRODUCT_CARD) {
    await db.productCardGeneration.update({
      where: { id: generationId },
      data: updateData,
    });
  } else if (type === GenerationType.SORA) {
    await db.soraGeneration.update({
      where: { id: generationId },
      data: updateData,
    });
  } else if (type === GenerationType.CHAT) {
    await db.generation.update({
      where: { id: generationId },
      data: updateData,
    });
  }

  // Emit appropriate event
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { emitProcessingEvent, emitCompletedEvent, emitFailedEvent } = require('./events');

  const eventPayload = {
    generationId,
    userId,
    type,
    metadata,
  };

  switch (status) {
    case GenerationStatus.processing:
      emitProcessingEvent(eventPayload);
      break;
    case GenerationStatus.completed:
      emitCompletedEvent(eventPayload);
      break;
    case GenerationStatus.failed:
      emitFailedEvent(eventPayload);
      break;
  }
}
