import { FastifyReply, FastifyRequest } from 'fastify';
import { ProductCardService, ProductCardOptions } from '@monorepo/shared';
import { StorageService } from '../services/storage.service';
import { TokenService } from '@monorepo/shared';
import { OperationType } from '@monorepo/database';
import { Monitoring } from '@monorepo/monitoring';
import { QueueService } from '../services/queue.service';

export interface UploadProductCardBody {
  productImage: {
    data: string; // base64 encoded
    mimeType: string;
  };
  options: ProductCardOptions;
}

export interface GetGenerationParams {
  id: string;
}

export interface GenerateMoreBody {
  options?: Partial<ProductCardOptions>;
}

export interface EditCardBody {
  options: Partial<ProductCardOptions>;
}

export class ProductCardController {
  private productCardService: ProductCardService;
  private storageService: StorageService;
  private tokenService: TokenService;
  private queueService: QueueService;
  private monitoring: Monitoring;

  constructor(
    productCardService: ProductCardService,
    storageService: StorageService,
    tokenService: TokenService,
    queueService: QueueService,
    monitoring: Monitoring
  ) {
    this.productCardService = productCardService;
    this.storageService = storageService;
    this.tokenService = tokenService;
    this.queueService = queueService;
    this.monitoring = monitoring;
  }

  async upload(
    request: FastifyRequest<{ Body: UploadProductCardBody }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { productImage, options } = request.body;
      const userId = (request as any).user?.userId;

      if (!userId) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }

      // Validate input
      if (!productImage) {
        reply.code(400).send({ error: 'Product image is required' });
        return;
      }

      if (!options || !options.mode) {
        reply.code(400).send({ error: 'Mode selection is required' });
        return;
      }

      // Check if user can afford the operation
      const affordability = await this.tokenService.canAfford(userId, OperationType.product_card);

      if (!affordability.canAfford) {
        reply.code(402).send({
          error: 'Insufficient tokens',
          required: affordability.cost,
          available: affordability.balance,
        });
        return;
      }

      // Process image
      const buffer = Buffer.from(productImage.data, 'base64');
      const metadata = await this.storageService.getImageMetadata(buffer);

      // Upload image to storage
      const storageResult = await this.storageService.uploadImage(
        buffer,
        productImage.mimeType,
        userId
      );

      // Create generation
      const generation = await this.productCardService.createGeneration({
        userId,
        productImageUrl: storageResult.storageUrl,
        productImageKey: storageResult.storageKey,
        options,
      });

      // Moderate generation
      const moderationResult = await this.productCardService.moderateGeneration(generation.id);

      if (!moderationResult.approved) {
        reply.code(400).send({
          error: 'Content moderation failed',
          reason: moderationResult.reason,
          generationId: generation.id,
        });
        return;
      }

      // Queue generation job
      await this.queueService.queueProductCardGeneration({
        generationId: generation.id,
        userId,
        productImageUrl: storageResult.storageUrl,
        options,
      });

      // Deduct tokens
      await this.tokenService.chargeForOperation(userId, OperationType.product_card, {
        generationId: generation.id,
        metadata: {
          mode: options.mode,
          hasBackground: !!options.background,
          hasPose: !!options.pose,
          hasText: !!(options.textHeadline || options.textSubheadline || options.textDescription),
        },
      });

      this.monitoring.logger.info(
        {
          generationId: generation.id,
          userId,
          mode: options.mode,
        },
        'Product card generation uploaded and queued'
      );

      reply.code(201).send({
        id: generation.id,
        status: 'pending',
        moderationStatus: 'approved',
        message: 'Generation queued successfully',
      });
    } catch (error) {
      this.monitoring.handleError(error as Error, {
        endpoint: 'product-card-upload',
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

      const generation = await this.productCardService.getGeneration(id);

      if (generation.userId !== userId) {
        reply.code(403).send({ error: 'Forbidden' });
        return;
      }

      reply.send({
        id: generation.id,
        status: generation.status,
        moderationStatus: generation.moderationStatus,
        productImageUrl: generation.productImageUrl,
        mode: generation.mode,
        background: generation.background,
        pose: generation.pose,
        textHeadline: generation.textHeadline,
        textSubheadline: generation.textSubheadline,
        textDescription: generation.textDescription,
        resultUrls: generation.resultUrls,
        errorMessage: generation.errorMessage,
        tokensUsed: generation.tokensUsed,
        retryCount: generation.retryCount,
        parentGenerationId: generation.parentGenerationId,
        createdAt: generation.createdAt,
        startedAt: generation.startedAt,
        completedAt: generation.completedAt,
      });
    } catch (error) {
      this.monitoring.handleError(error as Error, {
        endpoint: 'product-card-get-generation',
        generationId: request.params.id,
      });

      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.code(500).send({ error: message });
    }
  }

  async generateMore(
    request: FastifyRequest<{ Params: GetGenerationParams; Body: GenerateMoreBody }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const { options } = request.body;
      const userId = (request as any).user?.userId;

      if (!userId) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }

      const parentGeneration = await this.productCardService.getGeneration(id);

      if (parentGeneration.userId !== userId) {
        reply.code(403).send({ error: 'Forbidden' });
        return;
      }

      if (parentGeneration.status !== 'completed') {
        reply.code(400).send({ error: 'Only completed generations can be used to generate more' });
        return;
      }

      // Check if user can afford the operation
      const affordability = await this.tokenService.canAfford(userId, OperationType.product_card);

      if (!affordability.canAfford) {
        reply.code(402).send({
          error: 'Insufficient tokens',
          required: affordability.cost,
          available: affordability.balance,
        });
        return;
      }

      // Create variant generation
      const generation = await this.productCardService.createVariant(id, options);

      // Moderate generation
      const moderationResult = await this.productCardService.moderateGeneration(generation.id);

      if (!moderationResult.approved) {
        reply.code(400).send({
          error: 'Content moderation failed',
          reason: moderationResult.reason,
          generationId: generation.id,
        });
        return;
      }

      // Queue generation job
      await this.queueService.queueProductCardGeneration({
        generationId: generation.id,
        userId,
        productImageUrl: generation.productImageUrl,
        options: {
          mode: generation.mode,
          background: generation.background || undefined,
          pose: generation.pose || undefined,
          textHeadline: generation.textHeadline || undefined,
          textSubheadline: generation.textSubheadline || undefined,
          textDescription: generation.textDescription || undefined,
        },
      });

      // Deduct tokens
      await this.tokenService.chargeForOperation(userId, OperationType.product_card, {
        generationId: generation.id,
        metadata: {
          parentGenerationId: id,
          action: 'generate_more',
        },
      });

      this.monitoring.logger.info(
        {
          generationId: generation.id,
          parentGenerationId: id,
          userId,
        },
        'Product card generate more queued'
      );

      reply.code(201).send({
        id: generation.id,
        status: 'pending',
        moderationStatus: 'approved',
        message: 'Generation queued successfully',
      });
    } catch (error) {
      this.monitoring.handleError(error as Error, {
        endpoint: 'product-card-generate-more',
        generationId: request.params.id,
        userId: (request as any).user?.userId,
      });

      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.code(500).send({ error: message });
    }
  }

  async editCard(
    request: FastifyRequest<{ Params: GetGenerationParams; Body: EditCardBody }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { id } = request.params;
      const { options } = request.body;
      const userId = (request as any).user?.userId;

      if (!userId) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }

      if (!options || Object.keys(options).length === 0) {
        reply.code(400).send({ error: 'At least one option must be provided' });
        return;
      }

      const parentGeneration = await this.productCardService.getGeneration(id);

      if (parentGeneration.userId !== userId) {
        reply.code(403).send({ error: 'Forbidden' });
        return;
      }

      if (parentGeneration.status !== 'completed') {
        reply.code(400).send({ error: 'Only completed generations can be edited' });
        return;
      }

      // Check if user can afford the operation
      const affordability = await this.tokenService.canAfford(userId, OperationType.product_card);

      if (!affordability.canAfford) {
        reply.code(402).send({
          error: 'Insufficient tokens',
          required: affordability.cost,
          available: affordability.balance,
        });
        return;
      }

      // Create variant generation with edited options
      const generation = await this.productCardService.createVariant(id, options);

      // Moderate generation
      const moderationResult = await this.productCardService.moderateGeneration(generation.id);

      if (!moderationResult.approved) {
        reply.code(400).send({
          error: 'Content moderation failed',
          reason: moderationResult.reason,
          generationId: generation.id,
        });
        return;
      }

      // Queue generation job
      await this.queueService.queueProductCardGeneration({
        generationId: generation.id,
        userId,
        productImageUrl: generation.productImageUrl,
        options: {
          mode: generation.mode,
          background: generation.background || undefined,
          pose: generation.pose || undefined,
          textHeadline: generation.textHeadline || undefined,
          textSubheadline: generation.textSubheadline || undefined,
          textDescription: generation.textDescription || undefined,
        },
      });

      // Deduct tokens
      await this.tokenService.chargeForOperation(userId, OperationType.product_card, {
        generationId: generation.id,
        metadata: {
          parentGenerationId: id,
          action: 'edit_card',
          editedFields: Object.keys(options),
        },
      });

      this.monitoring.logger.info(
        {
          generationId: generation.id,
          parentGenerationId: id,
          userId,
          editedFields: Object.keys(options),
        },
        'Product card edit queued'
      );

      reply.code(201).send({
        id: generation.id,
        status: 'pending',
        moderationStatus: 'approved',
        message: 'Generation queued successfully',
      });
    } catch (error) {
      this.monitoring.handleError(error as Error, {
        endpoint: 'product-card-edit',
        generationId: request.params.id,
        userId: (request as any).user?.userId,
      });

      const message = error instanceof Error ? error.message : 'Unknown error';
      reply.code(500).send({ error: message });
    }
  }
}
