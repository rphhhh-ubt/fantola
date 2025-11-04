import { FastifyReply, FastifyRequest } from 'fastify';
import { SoraService } from '../services/sora.service';
import { StorageService } from '../services/storage.service';
import { TokenService } from '@monorepo/shared';
import { OperationType } from '@monorepo/database';
import { Monitoring } from '@monorepo/monitoring';
import { QueueService } from '../services/queue.service';

export interface UploadSoraBody {
  prompt: string;
  images: Array<{
    data: string; // base64 encoded
    mimeType: string;
  }>;
}

export interface GetGenerationParams {
  id: string;
}

export interface RetryGenerationParams {
  id: string;
}

export class SoraController {
  private soraService: SoraService;
  private storageService: StorageService;
  private tokenService: TokenService;
  private queueService: QueueService;
  private monitoring: Monitoring;

  constructor(
    soraService: SoraService,
    storageService: StorageService,
    tokenService: TokenService,
    queueService: QueueService,
    monitoring: Monitoring
  ) {
    this.soraService = soraService;
    this.storageService = storageService;
    this.tokenService = tokenService;
    this.queueService = queueService;
    this.monitoring = monitoring;
  }

  async upload(
    request: FastifyRequest<{ Body: UploadSoraBody }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { prompt, images } = request.body;
      const userId = (request as any).user?.userId;

      if (!userId) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }

      // Validate input
      if (!images || images.length === 0) {
        reply.code(400).send({ error: 'At least one image is required' });
        return;
      }

      if (images.length > 4) {
        reply.code(400).send({ error: 'Maximum 4 images allowed' });
        return;
      }

      if (!prompt || prompt.trim().length === 0) {
        reply.code(400).send({ error: 'Prompt is required' });
        return;
      }

      // Check if user can afford the operation
      const affordability = await this.tokenService.canAfford(userId, OperationType.sora_image);

      if (!affordability.canAfford) {
        reply.code(402).send({
          error: 'Insufficient tokens',
          required: affordability.cost,
          available: affordability.balance,
        });
        return;
      }

      // Process images
      const processedImages = await Promise.all(
        images.map(async (image) => {
          const buffer = Buffer.from(image.data, 'base64');
          const metadata = await this.storageService.getImageMetadata(buffer);

          return {
            buffer,
            mimeType: image.mimeType,
            size: buffer.length,
            width: metadata.width,
            height: metadata.height,
          };
        })
      );

      // Create generation
      const generation = await this.soraService.createGeneration({
        userId,
        prompt,
        images: processedImages,
      });

      // Upload images to temporary storage
      const storageResults = await Promise.all(
        processedImages.map((image) =>
          this.storageService.uploadImage(image.buffer, image.mimeType, userId)
        )
      );

      // Store image references
      await this.soraService.storeImages(generation.id, processedImages, storageResults);

      // Moderate generation
      const moderationResult = await this.soraService.moderateGeneration(generation.id);

      if (!moderationResult.approved) {
        reply.code(400).send({
          error: 'Content moderation failed',
          reason: moderationResult.reason,
          generationId: generation.id,
        });
        return;
      }

      // Queue generation job
      await this.queueService.queueSoraGeneration({
        generationId: generation.id,
        userId,
        prompt,
        imageUrls: storageResults.map((r) => r.storageUrl),
      });

      // Deduct tokens
      await this.tokenService.chargeForOperation(userId, OperationType.sora_image, {
        generationId: generation.id,
        metadata: {
          prompt,
          imageCount: images.length,
        },
      });

      this.monitoring.logger.info(
        {
          generationId: generation.id,
          userId,
          imageCount: images.length,
        },
        'Sora generation uploaded and queued'
      );

      reply.code(201).send({
        id: generation.id,
        status: 'pending',
        moderationStatus: 'approved',
        message: 'Generation queued successfully',
      });
    } catch (error) {
      this.monitoring.handleError(error as Error, {
        endpoint: 'sora-upload',
        userId: (request as any).user?.userId,
      });

      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.code(500).send({ error: message });
    }
  }

  async getGeneration(
    request: FastifyRequest<{ Params: GetGenerationParams }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const userId = (request as any).user?.userId;

      if (!userId) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }

      const generation = await this.soraService.getGeneration(id);

      if (generation.userId !== userId) {
        reply.code(403).send({ error: 'Forbidden' });
        return;
      }

      reply.send({
        id: generation.id,
        status: generation.status,
        moderationStatus: generation.moderationStatus,
        prompt: generation.prompt,
        resultUrls: generation.resultUrls,
        errorMessage: generation.errorMessage,
        tokensUsed: generation.tokensUsed,
        retryCount: generation.retryCount,
        createdAt: generation.createdAt,
        startedAt: generation.startedAt,
        completedAt: generation.completedAt,
        images: generation.images.map((img) => ({
          id: img.id,
          storageUrl: img.storageUrl,
          size: img.size,
          width: img.width,
          height: img.height,
          mimeType: img.mimeType,
          moderationStatus: img.moderationStatus,
        })),
      });
    } catch (error) {
      this.monitoring.handleError(error as Error, {
        endpoint: 'sora-get-generation',
        generationId: request.params.id,
      });

      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.code(500).send({ error: message });
    }
  }

  async retryGeneration(
    request: FastifyRequest<{ Params: RetryGenerationParams }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const userId = (request as any).user?.userId;

      if (!userId) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }

      const generation = await this.soraService.getGeneration(id);

      if (generation.userId !== userId) {
        reply.code(403).send({ error: 'Forbidden' });
        return;
      }

      if (generation.status !== 'failed') {
        reply.code(400).send({ error: 'Only failed generations can be retried' });
        return;
      }

      // Retry generation
      await this.soraService.retryGeneration(id);

      // Queue generation job again
      await this.queueService.queueSoraGeneration({
        generationId: id,
        userId,
        prompt: generation.prompt,
        imageUrls: generation.images.map((img) => img.storageUrl),
      });

      this.monitoring.logger.info(
        {
          generationId: id,
          userId,
          retryCount: generation.retryCount + 1,
        },
        'Sora generation retry initiated'
      );

      reply.send({
        id,
        status: 'pending',
        message: 'Generation retry queued successfully',
      });
    } catch (error) {
      this.monitoring.handleError(error as Error, {
        endpoint: 'sora-retry-generation',
        generationId: request.params.id,
      });

      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.code(500).send({ error: message });
    }
  }
}
