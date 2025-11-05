import { db, ProductCardGeneration } from '@monorepo/database';
import { ProductCardOptions, ProductCardModerationResult } from './types';
import { ModerationService } from '../image-generation/providers/moderation-service';

export interface CreateProductCardParams {
  userId: string;
  productImageUrl: string;
  productImageKey: string;
  options: ProductCardOptions;
}

export interface UpdateProductCardParams {
  options: Partial<ProductCardOptions>;
}

export class ProductCardService {
  private moderationService: ModerationService;

  constructor() {
    this.moderationService = new ModerationService();
  }

  async createGeneration(params: CreateProductCardParams): Promise<ProductCardGeneration> {
    const generation = await db.productCardGeneration.create({
      data: {
        userId: params.userId,
        productImageUrl: params.productImageUrl,
        productImageKey: params.productImageKey,
        mode: params.options.mode,
        background: params.options.background,
        pose: params.options.pose,
        textHeadline: params.options.textHeadline,
        textSubheadline: params.options.textSubheadline,
        textDescription: params.options.textDescription,
        status: 'pending',
        moderationStatus: 'pending',
      },
    });

    return generation;
  }

  async moderateGeneration(generationId: string): Promise<ProductCardModerationResult> {
    const generation = await db.productCardGeneration.findUnique({
      where: { id: generationId },
    });

    if (!generation) {
      throw new Error('Generation not found');
    }

    const textToModerate = [
      generation.textHeadline,
      generation.textSubheadline,
      generation.textDescription,
    ]
      .filter(Boolean)
      .join(' ');

    const moderationResult = this.moderationService.moderate(textToModerate);

    const moderationStatus = moderationResult.flagged ? 'rejected' : 'approved';
    const moderationReason = moderationResult.flagged
      ? `Content flagged: ${moderationResult.flaggedTerms?.join(', ')}`
      : undefined;

    await db.productCardGeneration.update({
      where: { id: generationId },
      data: {
        moderationStatus,
        moderationReason,
        moderatedAt: new Date(),
      },
    });

    return {
      approved: !moderationResult.flagged,
      reason: moderationReason,
      categories: moderationResult.categories,
    };
  }

  async getGeneration(generationId: string): Promise<ProductCardGeneration> {
    const generation = await db.productCardGeneration.findUnique({
      where: { id: generationId },
    });

    if (!generation) {
      throw new Error('Generation not found');
    }

    return generation;
  }

  async updateGeneration(
    generationId: string,
    params: UpdateProductCardParams
  ): Promise<ProductCardGeneration> {
    const generation = await db.productCardGeneration.update({
      where: { id: generationId },
      data: {
        background: params.options.background,
        pose: params.options.pose,
        textHeadline: params.options.textHeadline,
        textSubheadline: params.options.textSubheadline,
        textDescription: params.options.textDescription,
      },
    });

    return generation;
  }

  async startProcessing(generationId: string): Promise<ProductCardGeneration> {
    return await db.productCardGeneration.update({
      where: { id: generationId },
      data: {
        status: 'processing',
        startedAt: new Date(),
      },
    });
  }

  async completeGeneration(
    generationId: string,
    resultUrls: string[]
  ): Promise<ProductCardGeneration> {
    return await db.productCardGeneration.update({
      where: { id: generationId },
      data: {
        status: 'completed',
        resultUrls,
        completedAt: new Date(),
      },
    });
  }

  async failGeneration(generationId: string, errorMessage: string): Promise<ProductCardGeneration> {
    return await db.productCardGeneration.update({
      where: { id: generationId },
      data: {
        status: 'failed',
        errorMessage,
      },
    });
  }

  async retryGeneration(generationId: string): Promise<ProductCardGeneration> {
    return await db.productCardGeneration.update({
      where: { id: generationId },
      data: {
        status: 'pending',
        retryCount: {
          increment: 1,
        },
        lastRetryAt: new Date(),
      },
    });
  }

  async createVariant(
    parentGenerationId: string,
    options?: Partial<ProductCardOptions>
  ): Promise<ProductCardGeneration> {
    const parentGeneration = await this.getGeneration(parentGenerationId);

    const generation = await db.productCardGeneration.create({
      data: {
        userId: parentGeneration.userId,
        productImageUrl: parentGeneration.productImageUrl,
        productImageKey: parentGeneration.productImageKey,
        mode: options?.mode || parentGeneration.mode,
        background: options?.background ?? parentGeneration.background,
        pose: options?.pose ?? parentGeneration.pose,
        textHeadline: options?.textHeadline ?? parentGeneration.textHeadline,
        textSubheadline: options?.textSubheadline ?? parentGeneration.textSubheadline,
        textDescription: options?.textDescription ?? parentGeneration.textDescription,
        status: 'pending',
        moderationStatus: 'pending',
        parentGenerationId,
      },
    });

    return generation;
  }
}
