import { ImageGenerationService } from '../image-generation-service';
import { ProviderSelector } from '../providers/provider-selector';
import { ImageProvider } from '../types';
import type { ProviderConfig } from '../types';
import {
  MockFalClient,
  MockTogetherClient,
  MockReplicateClient,
} from '../../../../test-utils/src/mocks/image-providers';

describe('ImageGenerationService', () => {
  let falClient: MockFalClient;
  let togetherClient: MockTogetherClient;
  let replicateClient: MockReplicateClient;
  let providerSelector: ProviderSelector;
  let service: ImageGenerationService;

  const createConfigs = (): ProviderConfig[] => [
    {
      provider: ImageProvider.FAL,
      apiKey: 'test-fal',
      enabled: true,
      priority: 1,
      models: ['*'],
    },
    {
      provider: ImageProvider.TOGETHER,
      apiKey: 'test-together',
      enabled: true,
      priority: 2,
      models: ['*'],
    },
    {
      provider: ImageProvider.REPLICATE,
      apiKey: 'test-replicate',
      enabled: true,
      priority: 3,
      models: ['*'],
    },
  ];

  beforeEach(() => {
    falClient = new MockFalClient();
    togetherClient = new MockTogetherClient();
    replicateClient = new MockReplicateClient();
    providerSelector = new ProviderSelector(
      [falClient, togetherClient, replicateClient],
      createConfigs(),
    );
    service = new ImageGenerationService(providerSelector, {
      moderationEnabled: true,
      maxRetries: 3,
      retryDelayMs: 10,
    });
  });

  afterEach(() => {
    falClient.reset();
    togetherClient.reset();
    replicateClient.reset();
  });

  describe('generateImage', () => {
    it('should successfully generate an image', async () => {
      const response = await service.generateImage({
        prompt: 'A beautiful landscape',
        model: 'test-model',
      });

      expect(response).toBeDefined();
      expect(response.provider).toBe(ImageProvider.REPLICATE); // Highest priority
      expect(response.images).toHaveLength(1);
    });

    it('should block inappropriate content', async () => {
      await expect(
        service.generateImage({
          prompt: 'nude explicit content',
          model: 'test-model',
        }),
      ).rejects.toThrow('Content moderation flagged');
    });

    it('should allow generation when moderation is disabled', async () => {
      const noModService = new ImageGenerationService(providerSelector, {
        moderationEnabled: false,
      });

      const response = await noModService.generateImage({
        prompt: 'nude explicit content',
        model: 'test-model',
      });

      expect(response).toBeDefined();
    });

    it('should fail when no providers are available', async () => {
      const emptySelector = new ProviderSelector([], []);
      const emptyService = new ImageGenerationService(emptySelector);

      await expect(
        emptyService.generateImage({
          prompt: 'test',
          model: 'test-model',
        }),
      ).rejects.toThrow('No providers available');
    });

    it('should track cost for successful generation', async () => {
      await service.generateImage({
        prompt: 'test',
        model: 'test-model',
      });

      const costs = service.getCostTracking();
      expect(costs).toHaveLength(1);
      expect(costs[0].successful).toBe(true);
      expect(costs[0].provider).toBe(ImageProvider.REPLICATE);
    });
  });

  describe('failover behavior', () => {
    it('should failover to next provider on error', async () => {
      // Make Replicate fail
      replicateClient.setShouldFail(true);

      const response = await service.generateImage({
        prompt: 'test',
        model: 'test-model',
      });

      // Should fallback to Together (priority 2)
      expect(response.provider).toBe(ImageProvider.TOGETHER);
    });

    it('should try all providers before failing', async () => {
      // Make all providers fail
      replicateClient.setShouldFail(true);
      togetherClient.setShouldFail(true);
      falClient.setShouldFail(true);

      await expect(
        service.generateImage({
          prompt: 'test',
          model: 'test-model',
        }),
      ).rejects.toThrow('All providers failed');
    });

    it('should track failed attempts in cost tracking', async () => {
      replicateClient.setShouldFail(true);
      togetherClient.setShouldFail(true);
      falClient.setShouldFail(true);

      try {
        await service.generateImage({
          prompt: 'test',
          model: 'test-model',
        });
      } catch (error) {
        // Expected to fail
      }

      const costs = service.getCostTracking();
      expect(costs.length).toBeGreaterThan(0);
      const failedCosts = costs.filter((c) => !c.successful);
      expect(failedCosts.length).toBeGreaterThan(0);
    });

    it('should include all error messages when all providers fail', async () => {
      replicateClient.setShouldFail(true);
      togetherClient.setShouldFail(true);
      falClient.setShouldFail(true);

      try {
        await service.generateImage({
          prompt: 'test',
          model: 'test-model',
        });
        fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('All providers failed');
        expect(error.message).toContain('replicate');
        expect(error.message).toContain('together');
        expect(error.message).toContain('fal');
      }
    });
  });

  describe('retry behavior', () => {
    it('should retry on transient errors', async () => {
      let attempts = 0;
      const originalGenerate = replicateClient.generateImage.bind(replicateClient);
      
      replicateClient.generateImage = jest.fn().mockImplementation(async (request) => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Transient error');
        }
        return originalGenerate(request);
      });

      const response = await service.generateImage({
        prompt: 'test',
        model: 'test-model',
      });

      expect(response).toBeDefined();
      expect(attempts).toBe(2);
    });

    it('should respect maxRetries setting', async () => {
      const limitedService = new ImageGenerationService(providerSelector, {
        maxRetries: 2,
        retryDelayMs: 1,
      });

      let attempts = 0;
      replicateClient.generateImage = jest.fn().mockImplementation(() => {
        attempts++;
        throw new Error('Always fails');
      });

      try {
        await limitedService.generateImage({
          prompt: 'test',
          model: 'test-model',
        });
      } catch (error) {
        // Expected to fail
      }

      expect(attempts).toBeLessThanOrEqual(2);
    });
  });

  describe('generateImageWithProvider', () => {
    it('should generate with specific provider', async () => {
      const response = await service.generateImageWithProvider(ImageProvider.FAL, {
        prompt: 'test',
        model: 'test-model',
      });

      expect(response.provider).toBe(ImageProvider.FAL);
    });

    it('should fail if specific provider is unavailable', async () => {
      const configs = createConfigs();
      configs[0].enabled = false; // Disable FAL

      const selector = new ProviderSelector([falClient, togetherClient, replicateClient], configs);
      const testService = new ImageGenerationService(selector);

      await expect(
        testService.generateImageWithProvider(ImageProvider.FAL, {
          prompt: 'test',
          model: 'test-model',
        }),
      ).rejects.toThrow('not available');
    });

    it('should still apply moderation for specific provider', async () => {
      await expect(
        service.generateImageWithProvider(ImageProvider.FAL, {
          prompt: 'nude explicit',
          model: 'test-model',
        }),
      ).rejects.toThrow('Content moderation flagged');
    });
  });

  describe('getProviderHealth', () => {
    it('should check health of all providers', async () => {
      const health = await service.getProviderHealth();

      expect(health).toHaveLength(3);
      expect(health.every((h) => h.available)).toBe(true);
      expect(health.every((h) => h.latency !== undefined)).toBe(true);
    });

    it('should detect unavailable providers', async () => {
      falClient.setAvailabilityStatus(false);

      const health = await service.getProviderHealth();

      const falHealth = health.find((h) => h.provider === ImageProvider.FAL);
      expect(falHealth?.available).toBe(false);
    });

    it('should include error messages for failed health checks', async () => {
      falClient.isAvailable = jest.fn().mockRejectedValue(new Error('Connection timeout'));

      const health = await service.getProviderHealth();

      const falHealth = health.find((h) => h.provider === ImageProvider.FAL);
      expect(falHealth?.available).toBe(false);
      expect(falHealth?.error).toBeDefined();
    });
  });

  describe('cost tracking', () => {
    it('should track costs for each generation', async () => {
      await service.generateImage({ prompt: 'test 1', model: 'model-1' });
      await service.generateImage({ prompt: 'test 2', model: 'model-2' });

      const costs = service.getCostTracking();
      expect(costs).toHaveLength(2);
    });

    it('should calculate total cost', async () => {
      await service.generateImage({ prompt: 'test 1', model: 'model-1' });
      await service.generateImage({ prompt: 'test 2', model: 'model-2' });

      const totalCost = service.getTotalCost();
      expect(totalCost).toBeGreaterThan(0);
    });

    it('should clear cost tracking', async () => {
      await service.generateImage({ prompt: 'test', model: 'model-1' });

      service.clearCostTracking();

      const costs = service.getCostTracking();
      expect(costs).toHaveLength(0);
    });

    it('should include metadata in cost tracking', async () => {
      await service.generateImage({
        prompt: 'test',
        model: 'model-1',
        width: 512,
        height: 768,
        numImages: 2,
      });

      const costs = service.getCostTracking();
      expect(costs[0].metadata).toBeDefined();
      expect(costs[0].metadata?.width).toBe(512);
      expect(costs[0].metadata?.height).toBe(768);
      expect(costs[0].metadata?.numImages).toBe(2);
    });
  });

  describe('getModerationService', () => {
    it('should provide access to moderation service', () => {
      const moderationService = service.getModerationService();

      expect(moderationService).toBeDefined();
      expect(typeof moderationService.moderate).toBe('function');
    });

    it('should allow customizing moderation keywords', () => {
      const moderationService = service.getModerationService();
      moderationService.addKeywords('nudity', ['custom-term']);

      const result = moderationService.moderate('custom-term in prompt');
      expect(result.flagged).toBe(true);
    });
  });
});
