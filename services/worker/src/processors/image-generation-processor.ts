import { Job } from 'bullmq';
import { Monitoring } from '@monorepo/monitoring';
import { db } from '@monorepo/database';
import { BaseProcessor, TokenDeductionConfig, ProcessorContext } from './base-processor';
import {
  ImageGenerationJobData,
  QueueName,
  JobResult,
  ImageGenerationService,
  GenerationType,
} from '@monorepo/shared';
import { StorageAdapter, StorageConfig } from '../storage';
import { StorageFactory } from '../storage/storage-factory';
import axios from 'axios';

export interface ImageGenerationProcessorConfig extends ProcessorContext {
  storageConfig: StorageConfig;
  imageGenerationService?: ImageGenerationService;
}

/**
 * Processor for image generation jobs (DALL-E, Stable Diffusion, etc.)
 * Fetches provider results, updates DB status, stores outputs, and handles token deduction
 */
export class ImageGenerationProcessor extends BaseProcessor<ImageGenerationJobData> {
  private storage: StorageAdapter;
  private imageService?: ImageGenerationService;

  constructor(config: ImageGenerationProcessorConfig) {
    super(QueueName.IMAGE_GENERATION, config);
    this.storage = StorageFactory.createAdapter(config.storageConfig);
    this.imageService = config.imageGenerationService;
  }

  protected getTokenDeductionConfig(): TokenDeductionConfig {
    return {
      enabled: true,
      operationType: 'image_generation',
      skipDeductionOnFailure: true,
    };
  }

  protected getGenerationType(): GenerationType {
    return GenerationType.CHAT;
  }

  async process(job: Job<ImageGenerationJobData>): Promise<JobResult> {
    const { userId, prompt, tool, options } = job.data;

    this.monitoring.logger.info(
      {
        jobId: job.id,
        userId,
        tool,
        prompt: prompt.substring(0, 100),
      },
      'Processing image generation job'
    );

    try {
      // Find the generation record
      const generation = await db.generation.findFirst({
        where: {
          userId,
          tool: this.mapToolToGenerationTool(tool),
          status: {
            in: ['pending', 'processing'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!generation) {
        throw new Error('Generation record not found');
      }

      // Update status to processing
      await db.generation.update({
        where: { id: generation.id },
        data: {
          status: 'processing',
          startedAt: new Date(),
        },
      });

      // Generate images using the image generation service
      let resultUrls: string[] = [];

      if (this.imageService) {
        // Use real image generation service
        const response = await this.imageService.generateImage({
          prompt,
          model: this.getModelForTool(tool),
          numImages: options?.n || 1,
          width: this.parseSize(options?.size).width,
          height: this.parseSize(options?.size).height,
        });

        // Download and store images
        resultUrls = await this.storeGeneratedImages(
          response.images.map((img) => img.url),
          userId,
          generation.id
        );
      } else {
        // Mock/simulate image generation for testing
        resultUrls = await this.simulateImageGeneration(
          userId,
          generation.id,
          options?.n || 1
        );
      }

      // Update generation with results
      await db.generation.update({
        where: { id: generation.id },
        data: {
          status: 'completed',
          resultUrls,
          completedAt: new Date(),
        },
      });

      this.monitoring.logger.info(
        {
          jobId: job.id,
          generationId: generation.id,
          resultCount: resultUrls.length,
        },
        'Image generation completed successfully'
      );

      this.monitoring.metrics.trackGenerationSuccess(tool);

      return {
        success: true,
        data: {
          generationId: generation.id,
          resultUrls,
        },
      };
    } catch (error) {
      this.monitoring.logger.error(
        {
          jobId: job.id,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Image generation failed'
      );

      // Try to update generation status to failed
      try {
        const generation = await db.generation.findFirst({
          where: {
            userId,
            tool: this.mapToolToGenerationTool(tool),
            status: {
              in: ['pending', 'processing'],
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (generation) {
          await db.generation.update({
            where: { id: generation.id },
            data: {
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }
      } catch (dbError) {
        this.monitoring.logger.error(
          {
            dbError,
          },
          'Failed to update generation status to failed'
        );
      }

      this.monitoring.metrics.trackGenerationFailure(
        tool,
        error instanceof Error ? error.message : 'unknown'
      );

      throw error;
    }
  }

  private async storeGeneratedImages(
    imageUrls: string[],
    userId: string,
    generationId: string
  ): Promise<string[]> {
    const storedUrls: string[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      try {
        // Download image
        const response = await axios.get(imageUrls[i], {
          responseType: 'arraybuffer',
          timeout: 30000,
        });

        const imageBuffer = Buffer.from(response.data);

        // Store image
        const storageKey = `generations/${userId}/${generationId}/image-${i}.png`;
        const url = await this.storage.upload(storageKey, imageBuffer, 'image/png');

        storedUrls.push(url);

        this.monitoring.logger.debug(
          {
            generationId,
            imageIndex: i,
            size: imageBuffer.length,
            url,
          },
          'Stored generated image'
        );
      } catch (error) {
        this.monitoring.logger.error(
          {
            error,
            imageUrl: imageUrls[i],
            imageIndex: i,
          },
          'Failed to store generated image'
        );

        // Continue with partial results
      }
    }

    if (storedUrls.length === 0) {
      throw new Error('Failed to store any generated images');
    }

    return storedUrls;
  }

  private async simulateImageGeneration(
    userId: string,
    generationId: string,
    numImages: number
  ): Promise<string[]> {
    // Create placeholder images for testing
    const urls: string[] = [];

    for (let i = 0; i < numImages; i++) {
      urls.push(
        `${this.storage['config']?.baseUrl || 'http://localhost:3001/storage'}/generations/${userId}/${generationId}/image-${i}.png`
      );
    }

    return urls;
  }

  private mapToolToGenerationTool(tool: string): string {
    const mapping: Record<string, string> = {
      dalle: 'dalle',
      'stable-diffusion': 'stable_diffusion',
      sora: 'sora',
    };

    return mapping[tool] || tool;
  }

  private getModelForTool(tool: string): string {
    const models: Record<string, string> = {
      dalle: 'black-forest-labs/FLUX.1-schnell',
      'stable-diffusion': 'stabilityai/stable-diffusion-xl-base-1.0',
      sora: 'sora-v1',
    };

    return models[tool] || 'black-forest-labs/FLUX.1-schnell';
  }

  private parseSize(size?: string): { width: number; height: number } {
    if (!size) {
      return { width: 1024, height: 1024 };
    }

    const dimensions = size.split('x').map((s) => parseInt(s, 10));
    return {
      width: dimensions[0] || 1024,
      height: dimensions[1] || 1024,
    };
  }
}
