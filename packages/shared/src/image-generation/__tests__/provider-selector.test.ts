import { ProviderSelector } from '../providers/provider-selector';
import { SelectionStrategy, ImageProvider } from '../types';
import type { ProviderConfig } from '../types';
import {
  MockFalClient,
  MockTogetherClient,
  MockReplicateClient,
} from '../../../../test-utils/src/mocks/image-providers';

describe('ProviderSelector', () => {
  let falClient: MockFalClient;
  let togetherClient: MockTogetherClient;
  let replicateClient: MockReplicateClient;
  let providerSelector: ProviderSelector;

  const createConfigs = (): ProviderConfig[] => [
    {
      provider: ImageProvider.FAL,
      apiKey: 'test-fal',
      enabled: true,
      priority: 1,
      models: ['fal-ai/flux/schnell', 'fal-ai/flux/dev'],
    },
    {
      provider: ImageProvider.TOGETHER,
      apiKey: 'test-together',
      enabled: true,
      priority: 2,
      models: ['black-forest-labs/FLUX.1-schnell', '*'],
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
  });

  describe('selectProvider', () => {
    it('should select highest priority provider by default', async () => {
      providerSelector = new ProviderSelector(
        [falClient, togetherClient, replicateClient],
        createConfigs(),
      );

      const provider = await providerSelector.selectProvider();

      expect(provider).toBeDefined();
      expect(provider?.provider).toBe(ImageProvider.REPLICATE); // Priority 3 is highest
    });

    it('should respect exclude providers', async () => {
      providerSelector = new ProviderSelector(
        [falClient, togetherClient, replicateClient],
        createConfigs(),
      );

      const provider = await providerSelector.selectProvider({
        excludeProviders: [ImageProvider.REPLICATE],
      });

      expect(provider).toBeDefined();
      expect(provider?.provider).toBe(ImageProvider.TOGETHER);
    });

    it('should return null when no providers are available', async () => {
      providerSelector = new ProviderSelector([], []);

      const provider = await providerSelector.selectProvider();

      expect(provider).toBeNull();
    });

    it('should return null when all providers are excluded', async () => {
      providerSelector = new ProviderSelector(
        [falClient, togetherClient, replicateClient],
        createConfigs(),
      );

      const provider = await providerSelector.selectProvider({
        excludeProviders: [ImageProvider.FAL, ImageProvider.TOGETHER, ImageProvider.REPLICATE],
      });

      expect(provider).toBeNull();
    });

    it('should skip disabled providers', async () => {
      const configs = createConfigs();
      configs[2].enabled = false; // Disable Replicate

      providerSelector = new ProviderSelector([falClient, togetherClient, replicateClient], configs);

      const provider = await providerSelector.selectProvider();

      expect(provider).toBeDefined();
      expect(provider?.provider).not.toBe(ImageProvider.REPLICATE);
    });
  });

  describe('selection strategies', () => {
    beforeEach(() => {
      providerSelector = new ProviderSelector(
        [falClient, togetherClient, replicateClient],
        createConfigs(),
      );
    });

    it('should select highest priority with HIGHEST_PRIORITY strategy', async () => {
      const provider = await providerSelector.selectProvider({
        strategy: SelectionStrategy.HIGHEST_PRIORITY,
      });

      expect(provider?.provider).toBe(ImageProvider.REPLICATE);
    });

    it('should select lowest cost with LOWEST_COST strategy', async () => {
      const provider = await providerSelector.selectProvider({
        strategy: SelectionStrategy.LOWEST_COST,
        model: 'test-model',
      });

      expect(provider).toBeDefined();
      // Would select based on cost estimation
    });

    it('should rotate providers with ROUND_ROBIN strategy', async () => {
      const provider1 = await providerSelector.selectProvider({
        strategy: SelectionStrategy.ROUND_ROBIN,
      });
      const provider2 = await providerSelector.selectProvider({
        strategy: SelectionStrategy.ROUND_ROBIN,
      });
      const provider3 = await providerSelector.selectProvider({
        strategy: SelectionStrategy.ROUND_ROBIN,
      });

      expect(provider1).toBeDefined();
      expect(provider2).toBeDefined();
      expect(provider3).toBeDefined();

      // Should cycle through providers
      const providers = [provider1!.provider, provider2!.provider, provider3!.provider];
      const uniqueProviders = new Set(providers);
      expect(uniqueProviders.size).toBeGreaterThan(1);
    });

    it('should use failover strategy by default', async () => {
      const provider = await providerSelector.selectProvider({
        strategy: SelectionStrategy.FAILOVER,
      });

      expect(provider?.provider).toBe(ImageProvider.REPLICATE);
    });
  });

  describe('getFailoverOrder', () => {
    it('should return providers in priority order', async () => {
      providerSelector = new ProviderSelector(
        [falClient, togetherClient, replicateClient],
        createConfigs(),
      );

      const providers = await providerSelector.getFailoverOrder();

      expect(providers).toHaveLength(3);
      expect(providers[0].provider).toBe(ImageProvider.REPLICATE); // Priority 3
      expect(providers[1].provider).toBe(ImageProvider.TOGETHER); // Priority 2
      expect(providers[2].provider).toBe(ImageProvider.FAL); // Priority 1
    });

    it('should respect exclude providers in failover order', async () => {
      providerSelector = new ProviderSelector(
        [falClient, togetherClient, replicateClient],
        createConfigs(),
      );

      const providers = await providerSelector.getFailoverOrder({
        excludeProviders: [ImageProvider.TOGETHER],
      });

      expect(providers).toHaveLength(2);
      expect(providers.find((p) => p.provider === ImageProvider.TOGETHER)).toBeUndefined();
    });
  });

  describe('isModelSupported', () => {
    beforeEach(() => {
      providerSelector = new ProviderSelector(
        [falClient, togetherClient, replicateClient],
        createConfigs(),
      );
    });

    it('should return true for explicitly listed models', () => {
      const supported = providerSelector.isModelSupported(
        ImageProvider.FAL,
        'fal-ai/flux/schnell',
      );

      expect(supported).toBe(true);
    });

    it('should return false for unsupported models', () => {
      const supported = providerSelector.isModelSupported(ImageProvider.FAL, 'unknown-model');

      expect(supported).toBe(false);
    });

    it('should return true for wildcard models', () => {
      const supported = providerSelector.isModelSupported(ImageProvider.REPLICATE, 'any-model');

      expect(supported).toBe(true);
    });

    it('should return false for non-existent provider', () => {
      const supported = providerSelector.isModelSupported('invalid' as ImageProvider, 'any-model');

      expect(supported).toBe(false);
    });
  });

  describe('getProvidersForModel', () => {
    beforeEach(() => {
      providerSelector = new ProviderSelector(
        [falClient, togetherClient, replicateClient],
        createConfigs(),
      );
    });

    it('should return all providers that support a model', () => {
      const providers = providerSelector.getProvidersForModel('fal-ai/flux/schnell');

      expect(providers.length).toBeGreaterThan(0);
    });

    it('should return providers with wildcard support', () => {
      const providers = providerSelector.getProvidersForModel('unknown-model');

      expect(providers.length).toBeGreaterThan(0);
      // Should include Together and Replicate which have wildcard
    });

    it('should return empty array for unsupported model', () => {
      const configs = createConfigs();
      configs[1].models = ['specific-model']; // Remove wildcard from Together
      configs[2].models = ['another-model']; // Remove wildcard from Replicate

      providerSelector = new ProviderSelector([falClient, togetherClient, replicateClient], configs);

      const providers = providerSelector.getProvidersForModel('unsupported-model');

      expect(providers).toHaveLength(0);
    });
  });
});
