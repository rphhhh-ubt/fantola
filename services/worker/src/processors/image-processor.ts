import sharp from 'sharp';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Monitoring } from '@monorepo/monitoring';
import {
  ImageProcessingJob,
  ImageProcessingResult,
  ProcessingResult,
  ImageQualityVariant,
  StorageConfig,
  ProcessingMetrics,
} from '../types';
import { getQualityPreset } from '../config/quality-presets';

export class ImageProcessor {
  private s3Client: S3Client;
  private monitoring: Monitoring;
  private storageConfig: StorageConfig;

  constructor(storageConfig: StorageConfig, monitoring: Monitoring) {
    this.storageConfig = storageConfig;
    this.monitoring = monitoring;
    this.s3Client = new S3Client({
      region: storageConfig.region,
      endpoint: storageConfig.endpoint,
      credentials: storageConfig.accessKeyId && storageConfig.secretAccessKey
        ? {
            accessKeyId: storageConfig.accessKeyId,
            secretAccessKey: storageConfig.secretAccessKey,
          }
        : undefined,
    });
  }

  async processImage(job: ImageProcessingJob): Promise<ImageProcessingResult> {
    const startTime = Date.now();
    const variants: ProcessingResult[] = [];
    let originalSize = 0;

    try {
      const sourceBuffer = await this.loadSourceImage(job);
      originalSize = sourceBuffer.length;

      this.monitoring.logger.info(
        {
          jobId: job.id,
          tool: job.tool,
          originalSize,
          userId: job.userId,
        },
        'Starting image processing'
      );

      const normalVariant = await this.processVariant(
        job,
        sourceBuffer,
        ImageQualityVariant.NORMAL
      );
      variants.push(normalVariant);

      const hqVariant = await this.processVariant(
        job,
        sourceBuffer,
        ImageQualityVariant.HIGH_QUALITY
      );
      variants.push(hqVariant);

      const processingTimeMs = Date.now() - startTime;

      this.trackProcessingMetrics({
        processingTimeMs,
        originalSize,
        compressedSizes: {
          [ImageQualityVariant.NORMAL]: normalVariant.size,
          [ImageQualityVariant.HIGH_QUALITY]: hqVariant.size,
        },
        compressionRatio: originalSize / normalVariant.size,
        success: true,
        tool: job.tool,
      });

      this.monitoring.logger.info(
        {
          jobId: job.id,
          processingTimeMs,
          variants: variants.length,
          compressionRatio: (originalSize / normalVariant.size).toFixed(2),
        },
        'Image processing completed successfully'
      );

      return {
        jobId: job.id,
        success: true,
        variants,
        originalSize,
        processingTimeMs,
      };
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;

      this.trackProcessingMetrics({
        processingTimeMs,
        originalSize,
        compressedSizes: {
          [ImageQualityVariant.NORMAL]: 0,
          [ImageQualityVariant.HIGH_QUALITY]: 0,
        },
        compressionRatio: 0,
        success: false,
        tool: job.tool,
        error: (error as Error).message,
      });

      this.monitoring.handleError(error as Error, {
        jobId: job.id,
        tool: job.tool,
        userId: job.userId,
      });

      return {
        jobId: job.id,
        success: false,
        variants: [],
        originalSize,
        processingTimeMs,
        error: (error as Error).message,
      };
    }
  }

  private async loadSourceImage(job: ImageProcessingJob): Promise<Buffer> {
    if (job.sourceBuffer) {
      return job.sourceBuffer;
    }

    if (job.sourcePath && job.sourcePath.startsWith('s3://')) {
      const key = job.sourcePath.replace(`s3://${this.storageConfig.bucket}/`, '');
      const command = new GetObjectCommand({
        Bucket: this.storageConfig.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      const chunks: Uint8Array[] = [];

      if (response.Body) {
        const stream = response.Body as AsyncIterable<Uint8Array>;
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
      }

      return Buffer.concat(chunks);
    }

    if (job.sourceUrl) {
      const response = await fetch(job.sourceUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch source image: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    throw new Error('No valid source provided for image processing');
  }

  private async processVariant(
    job: ImageProcessingJob,
    sourceBuffer: Buffer,
    variant: ImageQualityVariant
  ): Promise<ProcessingResult> {
    const preset = getQualityPreset(job.tool, variant);

    const image = sharp(sourceBuffer);
    await image.metadata();

    let processedImage = image.resize(preset.maxWidth, preset.maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
    });

    if (preset.format === 'jpeg') {
      processedImage = processedImage.jpeg({
        quality: preset.quality,
        mozjpeg: true,
      });
    } else if (preset.format === 'webp') {
      processedImage = processedImage.webp({
        quality: preset.quality,
      });
    } else if (preset.format === 'png') {
      processedImage = processedImage.png({
        compressionLevel: preset.compressionLevel || 6,
      });
    }

    const processedBuffer = await processedImage.toBuffer();
    const processedMetadata = await sharp(processedBuffer).metadata();

    const key = this.generateStorageKey(job, variant);
    const url = await this.uploadToStorage(key, processedBuffer, preset.format);

    return {
      variant,
      url,
      size: processedBuffer.length,
      width: processedMetadata.width || 0,
      height: processedMetadata.height || 0,
      format: preset.format,
    };
  }

  private generateStorageKey(job: ImageProcessingJob, variant: ImageQualityVariant): string {
    const timestamp = Date.now();
    return `processed/${job.tool}/${job.userId}/${job.id}/${variant}-${timestamp}.jpg`;
  }

  private async uploadToStorage(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.storageConfig.bucket,
      Key: key,
      Body: buffer,
      ContentType: `image/${contentType}`,
    });

    await this.s3Client.send(command);

    if (this.storageConfig.endpoint) {
      return `${this.storageConfig.endpoint}/${this.storageConfig.bucket}/${key}`;
    }

    return `https://${this.storageConfig.bucket}.s3.${this.storageConfig.region}.amazonaws.com/${key}`;
  }

  private trackProcessingMetrics(metrics: ProcessingMetrics): void {
    this.monitoring.logger.info(
      {
        processingTimeMs: metrics.processingTimeMs,
        originalSize: metrics.originalSize,
        compressedSizes: metrics.compressedSizes,
        compressionRatio: metrics.compressionRatio,
        tool: metrics.tool,
        success: metrics.success,
      },
      'Image processing metrics'
    );

    if (metrics.success) {
      this.monitoring.metrics.trackGenerationSuccess('image_processing');
    } else {
      this.monitoring.metrics.trackGenerationFailure('image_processing', metrics.error || 'unknown');
    }

    this.monitoring.trackKPI({
      type: metrics.success ? 'generation_success' : 'generation_failure',
      data: {
        type: 'image_processing',
        tool: metrics.tool,
        processingTimeMs: metrics.processingTimeMs,
        compressionRatio: metrics.compressionRatio,
        error: metrics.error,
      },
    });
  }
}
