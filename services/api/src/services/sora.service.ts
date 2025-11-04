import { db } from '@monorepo/database';
import { Monitoring } from '@monorepo/monitoring';
import { v4 as uuidv4 } from 'uuid';

export interface UploadedImage {
  buffer: Buffer;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
}

export interface CreateSoraGenerationInput {
  userId: string;
  prompt: string;
  images: UploadedImage[];
}

export interface ModerationResult {
  approved: boolean;
  reason?: string;
}

export class SoraService {
  private monitoring: Monitoring;
  private readonly MAX_IMAGES = 4;
  private readonly MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  constructor(monitoring: Monitoring) {
    this.monitoring = monitoring;
  }

  async createGeneration(input: CreateSoraGenerationInput): Promise<{
    id: string;
    status: string;
    moderationStatus: string;
  }> {
    this.validateInput(input);

    const generationId = uuidv4();

    const generation = await db.soraGeneration.create({
      data: {
        id: generationId,
        userId: input.userId,
        prompt: input.prompt,
        status: 'pending',
        moderationStatus: 'pending',
        tokensUsed: 0,
      },
    });

    this.monitoring.logger.info(
      {
        generationId: generation.id,
        userId: input.userId,
        imageCount: input.images.length,
      },
      'Sora generation created'
    );

    return {
      id: generation.id,
      status: generation.status,
      moderationStatus: generation.moderationStatus,
    };
  }

  async storeImages(
    generationId: string,
    images: UploadedImage[],
    storageUrls: { storageKey: string; storageUrl: string }[]
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.soraImage.createMany({
      data: images.map((image, index) => ({
        generationId,
        storageKey: storageUrls[index].storageKey,
        storageUrl: storageUrls[index].storageUrl,
        size: image.size,
        width: image.width,
        height: image.height,
        mimeType: image.mimeType,
        moderationStatus: 'pending',
        expiresAt,
      })),
    });

    this.monitoring.logger.info(
      {
        generationId,
        imageCount: images.length,
      },
      'Sora images stored'
    );
  }

  async moderateGeneration(generationId: string): Promise<ModerationResult> {
    const generation = await db.soraGeneration.findUnique({
      where: { id: generationId },
      include: { images: true },
    });

    if (!generation) {
      throw new Error('Generation not found');
    }

    const moderationResults = await Promise.all(
      generation.images.map((image) => this.moderateImage(image.storageUrl))
    );

    const allApproved = moderationResults.every((result) => result.approved);

    const moderationStatus = allApproved ? 'approved' : 'rejected';
    const moderationReason = allApproved
      ? undefined
      : moderationResults.find((r) => !r.approved)?.reason;

    await db.soraGeneration.update({
      where: { id: generationId },
      data: {
        moderationStatus,
        moderationReason,
        moderatedAt: new Date(),
      },
    });

    if (!allApproved) {
      await db.soraImage.updateMany({
        where: { generationId },
        data: {
          moderationStatus: 'rejected',
          moderationReason,
          moderatedAt: new Date(),
        },
      });
    } else {
      await db.soraImage.updateMany({
        where: { generationId },
        data: {
          moderationStatus: 'approved',
          moderatedAt: new Date(),
        },
      });
    }

    this.monitoring.logger.info(
      {
        generationId,
        moderationStatus,
        moderationReason,
      },
      'Sora generation moderated'
    );

    return {
      approved: allApproved,
      reason: moderationReason,
    };
  }

  async getGeneration(generationId: string) {
    const generation = await db.soraGeneration.findUnique({
      where: { id: generationId },
      include: {
        images: true,
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
          },
        },
      },
    });

    if (!generation) {
      throw new Error('Generation not found');
    }

    return generation;
  }

  async updateGenerationStatus(
    generationId: string,
    status: string,
    data?: {
      resultUrls?: string[];
      errorMessage?: string;
      startedAt?: Date;
      completedAt?: Date;
      tokensUsed?: number;
    }
  ): Promise<void> {
    await db.soraGeneration.update({
      where: { id: generationId },
      data: {
        status,
        ...data,
      },
    });

    this.monitoring.logger.info(
      {
        generationId,
        status,
      },
      'Sora generation status updated'
    );
  }

  async retryGeneration(generationId: string): Promise<void> {
    const generation = await db.soraGeneration.findUnique({
      where: { id: generationId },
    });

    if (!generation) {
      throw new Error('Generation not found');
    }

    if (generation.status !== 'failed') {
      throw new Error('Only failed generations can be retried');
    }

    await db.soraGeneration.update({
      where: { id: generationId },
      data: {
        status: 'pending',
        retryCount: generation.retryCount + 1,
        lastRetryAt: new Date(),
        errorMessage: null,
      },
    });

    this.monitoring.logger.info(
      {
        generationId,
        retryCount: generation.retryCount + 1,
      },
      'Sora generation retry initiated'
    );
  }

  private validateInput(input: CreateSoraGenerationInput): void {
    if (!input.prompt || input.prompt.trim().length === 0) {
      throw new Error('Prompt is required');
    }

    if (input.prompt.length > 5000) {
      throw new Error('Prompt is too long (max 5000 characters)');
    }

    if (!input.images || input.images.length === 0) {
      throw new Error('At least one image is required');
    }

    if (input.images.length > this.MAX_IMAGES) {
      throw new Error(`Maximum ${this.MAX_IMAGES} images allowed`);
    }

    for (const image of input.images) {
      if (image.size > this.MAX_IMAGE_SIZE) {
        throw new Error(`Image size exceeds maximum allowed size of ${this.MAX_IMAGE_SIZE} bytes`);
      }

      if (!this.ALLOWED_MIME_TYPES.includes(image.mimeType)) {
        throw new Error(
          `Invalid image type: ${image.mimeType}. Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`
        );
      }
    }
  }

  private async moderateImage(imageUrl: string): Promise<ModerationResult> {
    // Simple moderation check - in production, integrate with a real moderation service
    // For now, we'll do basic checks and return approved

    // Example: Check for explicit content using an external service
    // const moderationService = new ModerationService();
    // const result = await moderationService.checkImage(imageUrl);

    // For this implementation, we'll simulate moderation
    // In production, integrate with services like:
    // - AWS Rekognition
    // - Google Cloud Vision API
    // - Azure Content Moderator
    // - Sightengine
    // - Hive Moderation

    this.monitoring.logger.debug(
      {
        imageUrl,
      },
      'Moderating image'
    );

    // Simulate moderation delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    // For now, approve all images
    // In production, this should call a real moderation API
    return {
      approved: true,
    };
  }
}
