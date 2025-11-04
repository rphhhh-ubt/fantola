import {
  createProductCardJob,
  createSoraJob,
  createChatJob,
  updateGenerationStatus,
  CreateProductCardJobOptions,
  CreateSoraJobOptions,
  CreateChatJobOptions,
} from '../../queue/generation-helpers';
import { JobPriority } from '../../queue/types';
import { getTierPriority } from '../../queue/config';
import { generationEvents, GenerationEventType, GenerationType } from '../../queue/events';

// Import enums from local re-export
enum GenerationStatus {
  pending = 'pending',
  processing = 'processing',
  completed = 'completed',
  failed = 'failed',
  canceled = 'canceled',
}

enum GenerationTool {
  dalle = 'dalle',
  sora = 'sora',
  stable_diffusion = 'stable_diffusion',
  chatgpt = 'chatgpt',
  product_card = 'product_card',
}

// Mock database
const mockDb = {
  productCardGeneration: {
    create: jest.fn(),
    update: jest.fn(),
  },
  soraGeneration: {
    create: jest.fn(),
    update: jest.fn(),
  },
  generation: {
    create: jest.fn(),
    update: jest.fn(),
  },
} as any;

// Mock queue producer
const mockProducer = {
  addJob: jest.fn(),
} as any;

describe('Generation Helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    generationEvents.removeAllListeners();
  });

  describe('createProductCardJob', () => {
    const baseOptions: CreateProductCardJobOptions = {
      userId: 'user-123',
      userTier: 'Professional',
      productImageUrl: 'https://example.com/product.jpg',
      productImageKey: 'products/user-123/product.jpg',
      mode: 'clean',
      background: 'white',
      tokensUsed: 10,
    };

    it('should create a product card generation job', async () => {
      const generationId = 'gen-123';
      mockDb.productCardGeneration.create.mockResolvedValue({
        id: generationId,
        ...baseOptions,
        status: GenerationStatus.pending,
      });

      mockProducer.addJob.mockResolvedValue({
        id: 'job-123',
      });

      const result = await createProductCardJob(mockDb, mockProducer, baseOptions);

      expect(result).toEqual({
        generationId,
        jobId: 'job-123',
        status: GenerationStatus.pending,
      });

      expect(mockDb.productCardGeneration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: baseOptions.userId,
          status: GenerationStatus.pending,
          productImageUrl: baseOptions.productImageUrl,
          mode: baseOptions.mode,
          tokensUsed: 10,
        }),
      });
    });

    it('should apply tier-based priority', async () => {
      mockDb.productCardGeneration.create.mockResolvedValue({
        id: 'gen-123',
        status: GenerationStatus.pending,
      });

      mockProducer.addJob.mockResolvedValue({ id: 'job-123' });

      // Test Business tier (HIGH priority)
      await createProductCardJob(mockDb, mockProducer, {
        ...baseOptions,
        userTier: 'Business',
      });

      expect(mockProducer.addJob).toHaveBeenCalledWith(
        'product-card-generation',
        expect.any(Object),
        expect.objectContaining({
          priority: JobPriority.HIGH,
        }),
      );

      jest.clearAllMocks();
      mockDb.productCardGeneration.create.mockResolvedValue({
        id: 'gen-124',
        status: GenerationStatus.pending,
      });
      mockProducer.addJob.mockResolvedValue({ id: 'job-124' });

      // Test Gift tier (LOW priority)
      await createProductCardJob(mockDb, mockProducer, {
        ...baseOptions,
        userTier: 'Gift',
      });

      expect(mockProducer.addJob).toHaveBeenCalledWith(
        'product-card-generation',
        expect.any(Object),
        expect.objectContaining({
          priority: JobPriority.LOW,
        }),
      );
    });

    it('should emit queued event', async () => {
      const generationId = 'gen-123';
      mockDb.productCardGeneration.create.mockResolvedValue({
        id: generationId,
        status: GenerationStatus.pending,
      });

      mockProducer.addJob.mockResolvedValue({ id: 'job-123' });

      const eventPromise = new Promise((resolve) => {
        generationEvents.once(GenerationEventType.QUEUED, resolve);
      });

      await createProductCardJob(mockDb, mockProducer, baseOptions);

      const event = await eventPromise;
      expect(event).toMatchObject({
        generationId,
        userId: baseOptions.userId,
        type: GenerationType.PRODUCT_CARD,
        status: GenerationStatus.pending,
      });
    });

    it('should include optional fields', async () => {
      const generationId = 'gen-123';
      mockDb.productCardGeneration.create.mockResolvedValue({
        id: generationId,
        status: GenerationStatus.pending,
      });

      mockProducer.addJob.mockResolvedValue({ id: 'job-123' });

      const optionsWithExtras = {
        ...baseOptions,
        textHeadline: 'Amazing Product',
        textSubheadline: 'Best in class',
        textDescription: 'Full description',
        parentGenerationId: 'parent-123',
      };

      await createProductCardJob(mockDb, mockProducer, optionsWithExtras);

      expect(mockDb.productCardGeneration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          textHeadline: 'Amazing Product',
          textSubheadline: 'Best in class',
          textDescription: 'Full description',
          parentGenerationId: 'parent-123',
        }),
      });
    });
  });

  describe('createSoraJob', () => {
    const baseOptions: CreateSoraJobOptions = {
      userId: 'user-123',
      userTier: 'Professional',
      prompt: 'Generate a video of a sunset',
      imageUrls: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
      tokensUsed: 10,
    };

    it('should create a sora generation job', async () => {
      const generationId = 'gen-123';
      mockDb.soraGeneration.create.mockResolvedValue({
        id: generationId,
        ...baseOptions,
        status: GenerationStatus.pending,
      });

      mockProducer.addJob.mockResolvedValue({
        id: 'job-123',
      });

      const result = await createSoraJob(mockDb, mockProducer, baseOptions);

      expect(result).toEqual({
        generationId,
        jobId: 'job-123',
        status: GenerationStatus.pending,
      });

      expect(mockDb.soraGeneration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: baseOptions.userId,
          status: GenerationStatus.pending,
          prompt: baseOptions.prompt,
          tokensUsed: 10,
        }),
      });
    });

    it('should apply tier-based priority', async () => {
      mockDb.soraGeneration.create.mockResolvedValue({
        id: 'gen-123',
        status: GenerationStatus.pending,
      });

      mockProducer.addJob.mockResolvedValue({ id: 'job-123' });

      // Test Professional tier (NORMAL priority)
      await createSoraJob(mockDb, mockProducer, baseOptions);

      expect(mockProducer.addJob).toHaveBeenCalledWith(
        'sora-generation',
        expect.any(Object),
        expect.objectContaining({
          priority: JobPriority.NORMAL,
        }),
      );
    });

    it('should emit queued event', async () => {
      const generationId = 'gen-123';
      mockDb.soraGeneration.create.mockResolvedValue({
        id: generationId,
        status: GenerationStatus.pending,
      });

      mockProducer.addJob.mockResolvedValue({ id: 'job-123' });

      const eventPromise = new Promise((resolve) => {
        generationEvents.once(GenerationEventType.QUEUED, resolve);
      });

      await createSoraJob(mockDb, mockProducer, baseOptions);

      const event = await eventPromise;
      expect(event).toMatchObject({
        generationId,
        userId: baseOptions.userId,
        type: GenerationType.SORA,
        status: GenerationStatus.pending,
      });
    });
  });

  describe('createChatJob', () => {
    const baseOptions: CreateChatJobOptions = {
      userId: 'user-123',
      userTier: 'Professional',
      message: 'Hello, how are you?',
      conversationId: 'conv-123',
      model: 'gpt-4',
      tokensUsed: 5,
    };

    it('should create a chat processing job', async () => {
      const generationId = 'gen-123';
      mockDb.generation.create.mockResolvedValue({
        id: generationId,
        status: GenerationStatus.pending,
        tool: GenerationTool.chatgpt,
      });

      mockProducer.addJob.mockResolvedValue({
        id: 'job-123',
      });

      const result = await createChatJob(mockDb, mockProducer, baseOptions);

      expect(result).toEqual({
        generationId,
        jobId: 'job-123',
        status: GenerationStatus.pending,
      });

      expect(mockDb.generation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: baseOptions.userId,
          tool: GenerationTool.chatgpt,
          status: GenerationStatus.pending,
          prompt: baseOptions.message,
          model: baseOptions.model,
          tokensUsed: 5,
        }),
      });
    });

    it('should apply tier-based priority', async () => {
      mockDb.generation.create.mockResolvedValue({
        id: 'gen-123',
        status: GenerationStatus.pending,
        tool: GenerationTool.chatgpt,
      });

      mockProducer.addJob.mockResolvedValue({ id: 'job-123' });

      // Test Business tier (HIGH priority)
      await createChatJob(mockDb, mockProducer, {
        ...baseOptions,
        userTier: 'Business',
      });

      expect(mockProducer.addJob).toHaveBeenCalledWith(
        'chat-processing',
        expect.any(Object),
        expect.objectContaining({
          priority: JobPriority.HIGH,
        }),
      );
    });

    it('should emit queued event', async () => {
      const generationId = 'gen-123';
      mockDb.generation.create.mockResolvedValue({
        id: generationId,
        status: GenerationStatus.pending,
        tool: GenerationTool.chatgpt,
      });

      mockProducer.addJob.mockResolvedValue({ id: 'job-123' });

      const eventPromise = new Promise((resolve) => {
        generationEvents.once(GenerationEventType.QUEUED, resolve);
      });

      await createChatJob(mockDb, mockProducer, baseOptions);

      const event = await eventPromise;
      expect(event).toMatchObject({
        generationId,
        userId: baseOptions.userId,
        type: GenerationType.CHAT,
        status: GenerationStatus.pending,
      });
    });

    it('should include optional parameters', async () => {
      mockDb.generation.create.mockResolvedValue({
        id: 'gen-123',
        status: GenerationStatus.pending,
        tool: GenerationTool.chatgpt,
      });

      mockProducer.addJob.mockResolvedValue({ id: 'job-123' });

      const optionsWithExtras = {
        ...baseOptions,
        temperature: 0.7,
        maxTokens: 1000,
        stream: true,
      };

      await createChatJob(mockDb, mockProducer, optionsWithExtras);

      expect(mockProducer.addJob).toHaveBeenCalledWith(
        'chat-processing',
        expect.objectContaining({
          options: {
            temperature: 0.7,
            maxTokens: 1000,
            stream: true,
          },
        }),
        expect.any(Object),
      );
    });
  });

  describe('updateGenerationStatus', () => {
    it('should update product card generation status to processing', async () => {
      await updateGenerationStatus(
        mockDb,
        'gen-123',
        'user-123',
        GenerationType.PRODUCT_CARD,
        GenerationStatus.processing,
      );

      expect(mockDb.productCardGeneration.update).toHaveBeenCalledWith({
        where: { id: 'gen-123' },
        data: expect.objectContaining({
          status: GenerationStatus.processing,
          startedAt: expect.any(Date),
        }),
      });
    });

    it('should update sora generation status to completed', async () => {
      const resultUrls = ['https://example.com/result1.jpg', 'https://example.com/result2.jpg'];

      await updateGenerationStatus(
        mockDb,
        'gen-123',
        'user-123',
        GenerationType.SORA,
        GenerationStatus.completed,
        { resultUrls },
      );

      expect(mockDb.soraGeneration.update).toHaveBeenCalledWith({
        where: { id: 'gen-123' },
        data: expect.objectContaining({
          status: GenerationStatus.completed,
          completedAt: expect.any(Date),
          resultUrls,
        }),
      });
    });

    it('should update chat generation status to failed', async () => {
      const errorMessage = 'API rate limit exceeded';

      await updateGenerationStatus(
        mockDb,
        'gen-123',
        'user-123',
        GenerationType.CHAT,
        GenerationStatus.failed,
        { errorMessage },
      );

      expect(mockDb.generation.update).toHaveBeenCalledWith({
        where: { id: 'gen-123' },
        data: expect.objectContaining({
          status: GenerationStatus.failed,
          completedAt: expect.any(Date),
          errorMessage,
        }),
      });
    });

    it('should emit processing event', async () => {
      const eventPromise = new Promise((resolve) => {
        generationEvents.once(GenerationEventType.PROCESSING, resolve);
      });

      await updateGenerationStatus(
        mockDb,
        'gen-123',
        'user-123',
        GenerationType.PRODUCT_CARD,
        GenerationStatus.processing,
      );

      const event = await eventPromise;
      expect(event).toMatchObject({
        generationId: 'gen-123',
        userId: 'user-123',
        type: GenerationType.PRODUCT_CARD,
        status: GenerationStatus.processing,
      });
    });

    it('should emit completed event', async () => {
      const eventPromise = new Promise((resolve) => {
        generationEvents.once(GenerationEventType.COMPLETED, resolve);
      });

      await updateGenerationStatus(
        mockDb,
        'gen-123',
        'user-123',
        GenerationType.SORA,
        GenerationStatus.completed,
        { resultUrls: ['url1', 'url2'] },
      );

      const event = await eventPromise;
      expect(event).toMatchObject({
        generationId: 'gen-123',
        userId: 'user-123',
        type: GenerationType.SORA,
        status: GenerationStatus.completed,
      });
    });

    it('should emit failed event', async () => {
      const eventPromise = new Promise((resolve) => {
        generationEvents.once(GenerationEventType.FAILED, resolve);
      });

      await updateGenerationStatus(
        mockDb,
        'gen-123',
        'user-123',
        GenerationType.CHAT,
        GenerationStatus.failed,
        { errorMessage: 'Something went wrong' },
      );

      const event = await eventPromise;
      expect(event).toMatchObject({
        generationId: 'gen-123',
        userId: 'user-123',
        type: GenerationType.CHAT,
        status: GenerationStatus.failed,
      });
    });
  });

  describe('Tier-based priority mapping', () => {
    it('should map Business tier to HIGH priority', () => {
      expect(getTierPriority('Business')).toBe(JobPriority.HIGH);
    });

    it('should map Professional tier to NORMAL priority', () => {
      expect(getTierPriority('Professional')).toBe(JobPriority.NORMAL);
    });

    it('should map Gift tier to LOW priority', () => {
      expect(getTierPriority('Gift')).toBe(JobPriority.LOW);
    });

    it('should default to NORMAL priority for unknown tier', () => {
      expect(getTierPriority('UnknownTier')).toBe(JobPriority.NORMAL);
    });
  });
});
