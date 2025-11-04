import { ProviderSelector } from '../providers/provider-selector';
import { OpenRouterClient } from '../clients/openrouter-client';
import { GroqClient } from '../clients/groq-client';
import { ChatProvider, SelectionStrategy } from '../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('ProviderSelector', () => {
  let openrouterClient: OpenRouterClient;
  let groqClient: GroqClient;
  let selector: ProviderSelector;

  beforeEach(() => {
    openrouterClient = new OpenRouterClient({
      apiKey: 'test-openrouter-key',
    });
    groqClient = new GroqClient({
      apiKey: 'test-groq-key',
    });
    selector = new ProviderSelector([openrouterClient, groqClient]);
    jest.clearAllMocks();
  });

  describe('selectProvider', () => {
    it('should select provider with lowest cost strategy', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const provider = await selector.selectProvider({
        strategy: SelectionStrategy.LOWEST_COST,
        model: 'llama-3.1-8b-instant',
      });

      expect(provider).toBe(groqClient);
    });

    it('should select provider with highest priority strategy', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const provider = await selector.selectProvider({
        strategy: SelectionStrategy.HIGHEST_PRIORITY,
      });

      expect(provider).toBe(groqClient);
    });

    it('should select provider with round robin strategy', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const provider1 = await selector.selectProvider({
        strategy: SelectionStrategy.ROUND_ROBIN,
      });
      const provider2 = await selector.selectProvider({
        strategy: SelectionStrategy.ROUND_ROBIN,
      });

      expect(provider1).not.toBe(provider2);
      expect([provider1, provider2]).toContain(openrouterClient);
      expect([provider1, provider2]).toContain(groqClient);
    });

    it('should exclude specified providers', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const provider = await selector.selectProvider({
        excludeProviders: [ChatProvider.GROQ],
      });

      expect(provider).toBe(openrouterClient);
    });

    it('should throw error when no providers are available', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      await expect(
        selector.selectProvider({
          strategy: SelectionStrategy.LOWEST_COST,
        }),
      ).rejects.toThrow('No available chat providers');
    });

    it('should use default strategy when none specified', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const provider = await selector.selectProvider();

      expect(provider).toBeDefined();
    });
  });

  describe('getAvailableClients', () => {
    it('should return all available clients', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const clients = await selector.getAvailableClients();

      expect(clients).toHaveLength(2);
      expect(clients).toContain(openrouterClient);
      expect(clients).toContain(groqClient);
    });

    it('should exclude unavailable clients', async () => {
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('openrouter')) {
          return Promise.resolve({ ok: false });
        }
        return Promise.resolve({ ok: true });
      });

      const clients = await selector.getAvailableClients();

      expect(clients).toHaveLength(1);
      expect(clients[0]).toBe(groqClient);
    });

    it('should exclude specified providers', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const clients = await selector.getAvailableClients([ChatProvider.OPENROUTER]);

      expect(clients).toHaveLength(1);
      expect(clients[0]).toBe(groqClient);
    });

    it('should return empty array when no clients available', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      const clients = await selector.getAvailableClients();

      expect(clients).toHaveLength(0);
    });
  });

  describe('checkHealth', () => {
    it('should check and cache provider health', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const health = await selector.checkHealth(groqClient);

      expect(health).toEqual({
        provider: ChatProvider.GROQ,
        available: true,
        latency: expect.any(Number),
        lastChecked: expect.any(Date),
        error: undefined,
      });
    });

    it('should return cached health when within cache interval', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await selector.checkHealth(groqClient);
      const fetchCallCount = (global.fetch as jest.Mock).mock.calls.length;

      await selector.checkHealth(groqClient);
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCallCount);
    });

    it('should handle health check errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const health = await selector.checkHealth(groqClient);

      expect(health).toEqual({
        provider: ChatProvider.GROQ,
        available: false,
        latency: expect.any(Number),
        lastChecked: expect.any(Date),
        error: undefined,
      });
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status for all providers', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const statuses = await selector.getHealthStatus();

      expect(statuses).toHaveLength(2);
      expect(statuses[0]).toHaveProperty('provider');
      expect(statuses[0]).toHaveProperty('available');
      expect(statuses[0]).toHaveProperty('lastChecked');
    });

    it('should handle mixed health states', async () => {
      (global.fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('openrouter')) {
          return Promise.resolve({ ok: true });
        }
        return Promise.resolve({ ok: false });
      });

      const statuses = await selector.getHealthStatus();

      const openrouterStatus = statuses.find((s) => s.provider === ChatProvider.OPENROUTER);
      const groqStatus = statuses.find((s) => s.provider === ChatProvider.GROQ);

      expect(openrouterStatus?.available).toBe(true);
      expect(groqStatus?.available).toBe(false);
    });
  });

  describe('clearHealthCache', () => {
    it('should clear health cache', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await selector.checkHealth(groqClient);
      const firstCallCount = (global.fetch as jest.Mock).mock.calls.length;

      selector.clearHealthCache();

      await selector.checkHealth(groqClient);
      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(firstCallCount);
    });
  });
});
