import { ImageProcessor } from '../processors/image-processor';
import { Monitoring } from '@monorepo/monitoring';
import { MockS3Client } from '@monorepo/test-utils';
import { ImageTool, ImageQualityVariant, ImageProcessingJob, StorageConfig } from '../types';
import { getQualityPreset } from '../config/quality-presets';
import sharp from 'sharp';

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => mockS3Client),
    PutObjectCommand: jest.fn((params) => params),
    GetObjectCommand: jest.fn((params) => params),
  };
});

const mockS3Client = new MockS3Client();

const createMockBuffer = async (width: number, height: number): Promise<Buffer> => {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 0, b: 0 },
    },
  })
    .jpeg()
    .toBuffer();
};

const mockStorageConfig: StorageConfig = {
  bucket: 'test-bucket',
  region: 'us-east-1',
  endpoint: 'http://localhost:9000',
  accessKeyId: 'test-key',
  secretAccessKey: 'test-secret',
};

describe('ImageProcessor', () => {
  let imageProcessor: ImageProcessor;
  let monitoring: Monitoring;

  beforeEach(() => {
    monitoring = new Monitoring({ service: 'test' });
    jest.spyOn(monitoring.logger, 'info').mockImplementation();
    jest.spyOn(monitoring.logger, 'error').mockImplementation();
    jest.spyOn(monitoring.metrics, 'trackGenerationSuccess').mockImplementation();
    jest.spyOn(monitoring.metrics, 'trackGenerationFailure').mockImplementation();
    jest.spyOn(monitoring, 'trackKPI').mockImplementation();
    jest.spyOn(monitoring, 'handleError').mockImplementation();

    mockS3Client.clear();
    imageProcessor = new ImageProcessor(mockStorageConfig, monitoring);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processImage', () => {
    it('should process image with both normal and high-quality variants', async () => {
      const sourceBuffer = await createMockBuffer(2048, 2048);
      const job: ImageProcessingJob = {
        id: 'test-job-1',
        tool: ImageTool.DALL_E,
        sourceUrl: '',
        sourceBuffer,
        userId: 'user-123',
      };

      const result = await imageProcessor.processImage(job);

      expect(result.success).toBe(true);
      expect(result.variants).toHaveLength(2);
      expect(result.jobId).toBe('test-job-1');
      expect(result.originalSize).toBeGreaterThan(0);
      expect(result.processingTimeMs).toBeGreaterThan(0);

      const normalVariant = result.variants.find(
        (v) => v.variant === ImageQualityVariant.NORMAL
      );
      const hqVariant = result.variants.find(
        (v) => v.variant === ImageQualityVariant.HIGH_QUALITY
      );

      expect(normalVariant).toBeDefined();
      expect(hqVariant).toBeDefined();
      expect(normalVariant!.size).toBeGreaterThan(0);
      expect(hqVariant!.size).toBeGreaterThan(0);
    });

    it('should apply correct quality presets for DALL_E', async () => {
      const sourceBuffer = await createMockBuffer(2048, 2048);
      const job: ImageProcessingJob = {
        id: 'test-job-2',
        tool: ImageTool.DALL_E,
        sourceUrl: '',
        sourceBuffer,
        userId: 'user-123',
      };

      const result = await imageProcessor.processImage(job);

      const normalVariant = result.variants.find(
        (v) => v.variant === ImageQualityVariant.NORMAL
      );
      const hqVariant = result.variants.find(
        (v) => v.variant === ImageQualityVariant.HIGH_QUALITY
      );

      const normalPreset = getQualityPreset(ImageTool.DALL_E, ImageQualityVariant.NORMAL);
      const hqPreset = getQualityPreset(ImageTool.DALL_E, ImageQualityVariant.HIGH_QUALITY);

      expect(normalVariant!.width).toBeLessThanOrEqual(normalPreset.maxWidth);
      expect(normalVariant!.height).toBeLessThanOrEqual(normalPreset.maxHeight);
      expect(hqVariant!.width).toBeLessThanOrEqual(hqPreset.maxWidth);
      expect(hqVariant!.height).toBeLessThanOrEqual(hqPreset.maxHeight);
    });

    it('should apply correct quality presets for SORA', async () => {
      const sourceBuffer = await createMockBuffer(1920, 1080);
      const job: ImageProcessingJob = {
        id: 'test-job-3',
        tool: ImageTool.SORA,
        sourceUrl: '',
        sourceBuffer,
        userId: 'user-123',
      };

      const result = await imageProcessor.processImage(job);

      const normalVariant = result.variants.find(
        (v) => v.variant === ImageQualityVariant.NORMAL
      );
      const hqVariant = result.variants.find(
        (v) => v.variant === ImageQualityVariant.HIGH_QUALITY
      );

      const normalPreset = getQualityPreset(ImageTool.SORA, ImageQualityVariant.NORMAL);
      const hqPreset = getQualityPreset(ImageTool.SORA, ImageQualityVariant.HIGH_QUALITY);

      expect(normalVariant!.width).toBeLessThanOrEqual(normalPreset.maxWidth);
      expect(normalVariant!.height).toBeLessThanOrEqual(normalPreset.maxHeight);
      expect(hqVariant!.width).toBeLessThanOrEqual(hqPreset.maxWidth);
      expect(hqVariant!.height).toBeLessThanOrEqual(hqPreset.maxHeight);
    });

    it('should apply correct quality presets for STABLE_DIFFUSION', async () => {
      const sourceBuffer = await createMockBuffer(1536, 1536);
      const job: ImageProcessingJob = {
        id: 'test-job-4',
        tool: ImageTool.STABLE_DIFFUSION,
        sourceUrl: '',
        sourceBuffer,
        userId: 'user-123',
      };

      const result = await imageProcessor.processImage(job);

      const normalVariant = result.variants.find(
        (v) => v.variant === ImageQualityVariant.NORMAL
      );
      const hqVariant = result.variants.find(
        (v) => v.variant === ImageQualityVariant.HIGH_QUALITY
      );

      const normalPreset = getQualityPreset(
        ImageTool.STABLE_DIFFUSION,
        ImageQualityVariant.NORMAL
      );
      const hqPreset = getQualityPreset(
        ImageTool.STABLE_DIFFUSION,
        ImageQualityVariant.HIGH_QUALITY
      );

      expect(normalVariant!.width).toBeLessThanOrEqual(normalPreset.maxWidth);
      expect(normalVariant!.height).toBeLessThanOrEqual(normalPreset.maxHeight);
      expect(hqVariant!.width).toBeLessThanOrEqual(hqPreset.maxWidth);
      expect(hqVariant!.height).toBeLessThanOrEqual(hqPreset.maxHeight);
    });

    it('should compress images and reduce file size', async () => {
      const sourceBuffer = await createMockBuffer(2048, 2048);
      const job: ImageProcessingJob = {
        id: 'test-job-5',
        tool: ImageTool.DALL_E,
        sourceUrl: '',
        sourceBuffer,
        userId: 'user-123',
      };

      const result = await imageProcessor.processImage(job);

      const normalVariant = result.variants.find(
        (v) => v.variant === ImageQualityVariant.NORMAL
      );

      expect(normalVariant!.size).toBeLessThan(result.originalSize);
    });

    it('should upload processed images to storage', async () => {
      const sourceBuffer = await createMockBuffer(1024, 1024);
      const job: ImageProcessingJob = {
        id: 'test-job-6',
        tool: ImageTool.DALL_E,
        sourceUrl: '',
        sourceBuffer,
        userId: 'user-123',
      };

      mockS3Client.send = jest.fn().mockResolvedValue({ ETag: '"test-etag"' });

      const result = await imageProcessor.processImage(job);

      expect(result.success).toBe(true);
      expect(result.variants[0].url).toContain('test-bucket');
      expect(result.variants[0].url).toContain(job.id);
      expect(result.variants[1].url).toContain('test-bucket');
      expect(result.variants[1].url).toContain(job.id);
    });

    it('should track processing metrics', async () => {
      const sourceBuffer = await createMockBuffer(1024, 1024);
      const job: ImageProcessingJob = {
        id: 'test-job-7',
        tool: ImageTool.DALL_E,
        sourceUrl: '',
        sourceBuffer,
        userId: 'user-123',
      };

      mockS3Client.send = jest.fn().mockResolvedValue({ ETag: '"test-etag"' });

      await imageProcessor.processImage(job);

      expect(monitoring.metrics.trackGenerationSuccess).toHaveBeenCalledWith('image_processing');

      expect(monitoring.trackKPI).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'generation_success',
          data: expect.objectContaining({
            type: 'image_processing',
            tool: ImageTool.DALL_E,
          }),
        })
      );
    });

    it('should handle errors gracefully', async () => {
      const job: ImageProcessingJob = {
        id: 'test-job-8',
        tool: ImageTool.DALL_E,
        sourceUrl: '',
        userId: 'user-123',
      };

      const result = await imageProcessor.processImage(job);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.variants).toHaveLength(0);
      expect(monitoring.handleError).toHaveBeenCalled();
    });

    it('should track failure metrics on error', async () => {
      const job: ImageProcessingJob = {
        id: 'test-job-9',
        tool: ImageTool.DALL_E,
        sourceUrl: '',
        userId: 'user-123',
      };

      await imageProcessor.processImage(job);

      expect(monitoring.trackKPI).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'generation_failure',
          data: expect.objectContaining({
            type: 'image_processing',
            tool: ImageTool.DALL_E,
            error: expect.any(String),
          }),
        })
      );
    });

    it('should load source from S3 when sourcePath is provided', async () => {
      const sourceBuffer = await createMockBuffer(1024, 1024);
      await mockS3Client.putObject({
        Bucket: 'test-bucket',
        Key: 'test-source.jpg',
        Body: sourceBuffer,
      });

      const job: ImageProcessingJob = {
        id: 'test-job-10',
        tool: ImageTool.DALL_E,
        sourcePath: 's3://test-bucket/test-source.jpg',
        userId: 'user-123',
      };

      mockS3Client.send = jest.fn().mockResolvedValue({
        Body: {
          async *[Symbol.asyncIterator]() {
            yield sourceBuffer;
          },
        },
      });

      const result = await imageProcessor.processImage(job);

      expect(result.success).toBe(true);
      expect(mockS3Client.send).toHaveBeenCalled();
    });

    it('should load source from URL when sourceUrl is provided', async () => {
      const sourceBuffer = await createMockBuffer(1024, 1024);
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(sourceBuffer.buffer),
      });

      const job: ImageProcessingJob = {
        id: 'test-job-11',
        tool: ImageTool.DALL_E,
        sourceUrl: 'https://example.com/image.jpg',
        userId: 'user-123',
      };

      mockS3Client.send = jest.fn().mockResolvedValue({ ETag: '"test-etag"' });

      const result = await imageProcessor.processImage(job);

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/image.jpg');
    });

    it('should handle fetch errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      const job: ImageProcessingJob = {
        id: 'test-job-12',
        tool: ImageTool.DALL_E,
        sourceUrl: 'https://example.com/not-found.jpg',
        userId: 'user-123',
      };

      const result = await imageProcessor.processImage(job);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to fetch source image');
    });

    it('should preserve aspect ratio when resizing', async () => {
      const sourceBuffer = await createMockBuffer(2000, 1000);
      const job: ImageProcessingJob = {
        id: 'test-job-13',
        tool: ImageTool.DALL_E,
        sourceUrl: '',
        sourceBuffer,
        userId: 'user-123',
      };

      mockS3Client.send = jest.fn().mockResolvedValue({ ETag: '"test-etag"' });

      const result = await imageProcessor.processImage(job);

      const normalVariant = result.variants.find(
        (v) => v.variant === ImageQualityVariant.NORMAL
      );

      const aspectRatio = normalVariant!.width / normalVariant!.height;
      expect(aspectRatio).toBeCloseTo(2.0, 1);
    });

    it('should not enlarge images smaller than max dimensions', async () => {
      const sourceBuffer = await createMockBuffer(512, 512);
      const job: ImageProcessingJob = {
        id: 'test-job-14',
        tool: ImageTool.DALL_E,
        sourceUrl: '',
        sourceBuffer,
        userId: 'user-123',
      };

      mockS3Client.send = jest.fn().mockResolvedValue({ ETag: '"test-etag"' });

      const result = await imageProcessor.processImage(job);

      const normalVariant = result.variants.find(
        (v) => v.variant === ImageQualityVariant.NORMAL
      );

      expect(normalVariant!.width).toBe(512);
      expect(normalVariant!.height).toBe(512);
    });

    it('should include metadata in processing job', async () => {
      const sourceBuffer = await createMockBuffer(1024, 1024);
      const job: ImageProcessingJob = {
        id: 'test-job-15',
        tool: ImageTool.DALL_E,
        sourceUrl: '',
        sourceBuffer,
        userId: 'user-123',
        metadata: {
          prompt: 'Test prompt',
          model: 'dall-e-3',
        },
      };

      mockS3Client.send = jest.fn().mockResolvedValue({ ETag: '"test-etag"' });

      const result = await imageProcessor.processImage(job);

      expect(result.success).toBe(true);
      expect(monitoring.logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: job.id,
          tool: job.tool,
          userId: job.userId,
        }),
        expect.any(String)
      );
    });
  });
});
