import { Job } from 'bullmq';
import { Monitoring } from '@monorepo/monitoring';
import { db } from '@monorepo/database';
import { BaseProcessor } from './base-processor';
import { SoraGenerationJobData } from '@monorepo/shared';
import { StorageAdapter, StorageConfig } from '../storage';
import { StorageFactory } from '../storage/storage-factory';
import sharp from 'sharp';
import axios from 'axios';

export interface SoraProcessorConfig {
  monitoring: Monitoring;
  storageConfig: StorageConfig;
}

export class SoraProcessor extends BaseProcessor<SoraGenerationJobData, any> {
  private storage: StorageAdapter;

  constructor(config: SoraProcessorConfig) {
    super(config);
    this.storage = StorageFactory.createAdapter(config.storageConfig);
  }

  async process(job: Job<SoraGenerationJobData>): Promise<any> {
    const { generationId, userId, prompt, imageUrls } = job.data;

    this.monitoring.logger.info(
      {
        jobId: job.id,
        generationId,
        userId,
        imageCount: imageUrls.length,
      },
      'Processing Sora generation'
    );

    try {
      // Update status to processing
      await db.soraGeneration.update({
        where: { id: generationId },
        data: {
          status: 'processing',
          startedAt: new Date(),
        },
      });

      // Download input images
      const imageBuffers = await Promise.all(
        imageUrls.map((url) => this.downloadImage(url))
      );

      // Generate multi-resolution outputs
      // In production, this would call the actual Sora API
      // For now, we'll simulate by creating multiple resolutions of the first image
      const resultUrls = await this.generateMultiResolutionOutputs(
        generationId,
        userId,
        imageBuffers[0]
      );

      // Update generation with results
      await db.soraGeneration.update({
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
        'Sora generation completed successfully'
      );

      this.monitoring.metrics.trackGenerationSuccess('sora');

      return {
        success: true,
        generationId,
        resultUrls,
      };
    } catch (error) {
      this.monitoring.logger.error(
        {
          jobId: job.id,
          generationId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Sora generation failed'
      );

      // Update generation with error
      await db.soraGeneration.update({
        where: { id: generationId },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      this.monitoring.metrics.trackGenerationFailure(
        'sora',
        error instanceof Error ? error.message : 'unknown'
      );

      throw error;
    }
  }

  private async downloadImage(url: string): Promise<Buffer> {
    // If URL is from temporary storage, download from storage adapter
    if (url.includes('/storage/temp/')) {
      const storageKey = url.split('/storage/')[1];
      return await this.storage.download(storageKey);
    }

    // Otherwise, download from external URL
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
    });

    return Buffer.from(response.data);
  }

  private async generateMultiResolutionOutputs(
    generationId: string,
    userId: string,
    sourceImage: Buffer
  ): Promise<string[]> {
    const resolutions = [
      { name: '1080p', width: 1920, height: 1080 },
      { name: '720p', width: 1280, height: 720 },
      { name: '480p', width: 854, height: 480 },
    ];

    const results: string[] = [];

    for (const resolution of resolutions) {
      const processedImage = await sharp(sourceImage)
        .resize(resolution.width, resolution.height, {
          fit: 'cover',
          withoutEnlargement: false,
        })
        .jpeg({
          quality: 90,
          mozjpeg: true,
        })
        .toBuffer();

      const storageKey = `sora/${userId}/${generationId}/${resolution.name}.jpg`;
      const url = await this.storage.upload(storageKey, processedImage, 'image/jpeg');

      results.push(url);

      this.monitoring.logger.debug(
        {
          generationId,
          resolution: resolution.name,
          size: processedImage.length,
          url,
        },
        'Generated resolution output'
      );
    }

    return results;
  }
}
