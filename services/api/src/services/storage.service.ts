import { v4 as uuidv4 } from 'uuid';
import { Monitoring } from '@monorepo/monitoring';
import sharp from 'sharp';

export interface StorageResult {
  storageKey: string;
  storageUrl: string;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
}

export class StorageService {
  private monitoring: Monitoring;
  private storageMap: Map<string, Buffer> = new Map();
  private baseUrl: string;

  constructor(monitoring: Monitoring, baseUrl: string = 'http://localhost:3001/api/v1/storage') {
    this.monitoring = monitoring;
    this.baseUrl = baseUrl;
  }

  async uploadImage(buffer: Buffer, mimeType: string, userId: string): Promise<StorageResult> {
    const storageKey = `temp/sora/${userId}/${uuidv4()}.jpg`;

    // In production, upload to S3 or similar
    // For now, store in memory (for testing)
    this.storageMap.set(storageKey, buffer);

    const storageUrl = `${this.baseUrl}/${storageKey}`;

    this.monitoring.logger.debug(
      {
        storageKey,
        size: buffer.length,
        mimeType,
      },
      'Image uploaded to temporary storage'
    );

    return {
      storageKey,
      storageUrl,
    };
  }

  async downloadImage(storageKey: string): Promise<Buffer> {
    const buffer = this.storageMap.get(storageKey);

    if (!buffer) {
      throw new Error(`Image not found: ${storageKey}`);
    }

    return buffer;
  }

  async deleteImage(storageKey: string): Promise<void> {
    this.storageMap.delete(storageKey);

    this.monitoring.logger.debug(
      {
        storageKey,
      },
      'Image deleted from temporary storage'
    );
  }

  async getImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
    const metadata = await sharp(buffer).metadata();

    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: buffer.length,
    };
  }

  async cleanupExpiredImages(): Promise<void> {
    // In production, this would query the database for expired images
    // and delete them from storage
    this.monitoring.logger.info('Cleaning up expired images');
  }
}
