import { Job } from 'bullmq';
import { Monitoring } from '@monorepo/monitoring';
import { db } from '@monorepo/database';
import { BaseProcessor, TokenDeductionConfig } from './base-processor';
import { ProductCardGenerationJobData, QueueName, JobResult } from '@monorepo/shared';
import { StorageAdapter, StorageConfig } from '../storage';
import { StorageFactory } from '../storage/storage-factory';
import sharp from 'sharp';
import axios from 'axios';

export interface ProductCardProcessorConfig {
  monitoring: Monitoring;
  storageConfig: StorageConfig;
}

/**
 * Processor for product card generation jobs
 * Generates product cards with backgrounds, poses, and text overlays
 */
export class ProductCardProcessor extends BaseProcessor<ProductCardGenerationJobData> {
  private storage: StorageAdapter;

  constructor(config: ProductCardProcessorConfig) {
    super(QueueName.PRODUCT_CARD_GENERATION, config);
    this.storage = StorageFactory.createAdapter(config.storageConfig);
  }

  protected getTokenDeductionConfig(): TokenDeductionConfig {
    return {
      enabled: true,
      operationType: 'product_card',
      skipDeductionOnFailure: true,
    };
  }

  async process(job: Job<ProductCardGenerationJobData>): Promise<JobResult> {
    const { generationId, userId, productImageUrl, options } = job.data;

    this.monitoring.logger.info(
      {
        jobId: job.id,
        generationId,
        userId,
        mode: options.mode,
      },
      'Processing product card generation'
    );

    try {
      // Update status to processing
      await db.productCardGeneration.update({
        where: { id: generationId },
        data: {
          status: 'processing',
          startedAt: new Date(),
        },
      });

      // Download product image
      const productImageBuffer = await this.downloadImage(productImageUrl);

      // Generate product card(s)
      const resultUrls = await this.generateProductCards(
        generationId,
        userId,
        productImageBuffer,
        options
      );

      // Update generation with results
      await db.productCardGeneration.update({
        where: { id: generationId },
        data: {
          status: 'completed',
          resultUrls,
          completedAt: new Date(),
        },
      });

      this.monitoring.logger.info(
        {
          jobId: job.id,
          generationId,
          resultCount: resultUrls.length,
        },
        'Product card generation completed successfully'
      );

      this.monitoring.metrics.trackGenerationSuccess('product-card');

      return {
        success: true,
        data: {
          generationId,
          resultUrls,
        },
      };
    } catch (error) {
      this.monitoring.logger.error(
        {
          jobId: job.id,
          generationId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Product card generation failed'
      );

      // Update generation with error
      await db.productCardGeneration.update({
        where: { id: generationId },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      this.monitoring.metrics.trackGenerationFailure(
        'product-card',
        error instanceof Error ? error.message : 'unknown'
      );

      throw error;
    }
  }

  private async downloadImage(url: string): Promise<Buffer> {
    // If URL is from temporary storage, download from storage adapter
    if (url.includes('/storage/')) {
      const storageKey = url.split('/storage/')[1];
      return await this.storage.download(storageKey);
    }

    // Otherwise, download from external URL
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    return Buffer.from(response.data);
  }

  private async generateProductCards(
    generationId: string,
    userId: string,
    productImage: Buffer,
    options: ProductCardGenerationJobData['options']
  ): Promise<string[]> {
    const results: string[] = [];

    // Get product image metadata
    const metadata = await sharp(productImage).metadata();

    // Generate product card based on mode
    if (options.mode === 'clean') {
      // Generate clean product card with simple background
      const card = await this.generateCleanCard(productImage, metadata, options);
      const storageKey = `product-cards/${userId}/${generationId}/clean.jpg`;
      const url = await this.storage.upload(storageKey, card, 'image/jpeg');
      results.push(url);
    } else if (options.mode === 'infographics') {
      // Generate infographic-style product card
      const card = await this.generateInfographicCard(productImage, metadata, options);
      const storageKey = `product-cards/${userId}/${generationId}/infographic.jpg`;
      const url = await this.storage.upload(storageKey, card, 'image/jpeg');
      results.push(url);
    }

    this.monitoring.logger.debug(
      {
        generationId,
        mode: options.mode,
        resultCount: results.length,
      },
      'Generated product cards'
    );

    return results;
  }

  private async generateCleanCard(
    productImage: Buffer,
    metadata: sharp.Metadata,
    options: ProductCardGenerationJobData['options']
  ): Promise<Buffer> {
    // Create a clean product card with background
    const width = 1200;
    const height = 1200;

    // Apply background color or gradient
    const backgroundColor = options.background || '#ffffff';

    const card = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: backgroundColor,
      },
    })
      .composite([
        {
          input: await sharp(productImage)
            .resize(800, 800, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .toBuffer(),
          gravity: 'center',
        },
      ])
      .jpeg({
        quality: 90,
        mozjpeg: true,
      })
      .toBuffer();

    return card;
  }

  private async generateInfographicCard(
    productImage: Buffer,
    metadata: sharp.Metadata,
    options: ProductCardGenerationJobData['options']
  ): Promise<Buffer> {
    // Create an infographic-style product card
    const width = 1200;
    const height = 1600;

    const backgroundColor = options.background || '#f0f0f0';

    // In a real implementation, this would add text overlays, icons, etc.
    const card = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: backgroundColor,
      },
    })
      .composite([
        {
          input: await sharp(productImage)
            .resize(800, 800, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .toBuffer(),
          gravity: 'north',
          top: 100,
        },
      ])
      .jpeg({
        quality: 90,
        mozjpeg: true,
      })
      .toBuffer();

    return card;
  }
}
