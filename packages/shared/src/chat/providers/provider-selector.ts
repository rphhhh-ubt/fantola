import type {
  IChatClient,
  ChatProvider,
  ProviderSelectionOptions,
  ProviderHealth,
} from '../types';
import { SelectionStrategy as Strategy } from '../types';

/**
 * Provider selector for choosing the best available chat provider
 */
export class ProviderSelector {
  private clients: Map<ChatProvider, IChatClient>;
  private healthCache: Map<ChatProvider, ProviderHealth>;
  private roundRobinIndex: number = 0;
  private readonly healthCheckInterval: number = 60000; // 1 minute

  constructor(clients: IChatClient[]) {
    this.clients = new Map();
    this.healthCache = new Map();

    for (const client of clients) {
      this.clients.set(client.provider, client);
    }
  }

  /**
   * Select the best provider based on strategy
   */
  async selectProvider(options: ProviderSelectionOptions = {}): Promise<IChatClient> {
    const {
      model,
      strategy = Strategy.LOWEST_COST,
      excludeProviders = [],
    } = options;

    const availableClients = await this.getAvailableClients(excludeProviders);

    if (availableClients.length === 0) {
      throw new Error('No available chat providers');
    }

    let selectedClient: IChatClient;

    switch (strategy) {
      case Strategy.LOWEST_COST:
        selectedClient = this.selectLowestCost(availableClients, model);
        break;

      case Strategy.HIGHEST_PRIORITY:
        selectedClient = this.selectHighestPriority(availableClients);
        break;

      case Strategy.ROUND_ROBIN:
        selectedClient = this.selectRoundRobin(availableClients);
        break;

      default:
        selectedClient = availableClients[0];
    }

    return selectedClient;
  }

  /**
   * Get all available providers
   */
  async getAvailableClients(excludeProviders: ChatProvider[] = []): Promise<IChatClient[]> {
    const available: IChatClient[] = [];

    for (const [provider, client] of this.clients.entries()) {
      if (excludeProviders.includes(provider)) {
        continue;
      }

      const health = await this.checkHealth(client);
      if (health.available) {
        available.push(client);
      }
    }

    return available;
  }

  /**
   * Check provider health with caching
   */
  async checkHealth(client: IChatClient): Promise<ProviderHealth> {
    const cached = this.healthCache.get(client.provider);
    const now = new Date();

    if (cached && now.getTime() - cached.lastChecked.getTime() < this.healthCheckInterval) {
      return cached;
    }

    const startTime = Date.now();
    let available = false;
    let error: string | undefined;

    try {
      available = await client.isAvailable();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const health: ProviderHealth = {
      provider: client.provider,
      available,
      latency: Date.now() - startTime,
      lastChecked: now,
      error,
    };

    this.healthCache.set(client.provider, health);
    return health;
  }

  /**
   * Get health status for all providers
   */
  async getHealthStatus(): Promise<ProviderHealth[]> {
    const healthStatuses: ProviderHealth[] = [];

    for (const client of this.clients.values()) {
      const health = await this.checkHealth(client);
      healthStatuses.push(health);
    }

    return healthStatuses;
  }

  /**
   * Clear health cache
   */
  clearHealthCache(): void {
    this.healthCache.clear();
  }

  private selectLowestCost(clients: IChatClient[], model?: string): IChatClient {
    // Estimate cost for 1000 prompt tokens and 500 completion tokens
    const estimatedPromptTokens = 1000;
    const estimatedCompletionTokens = 500;

    let lowestCost = Infinity;
    let selectedClient = clients[0];

    for (const client of clients) {
      const cost = client.estimateCost(
        model || 'default',
        estimatedPromptTokens,
        estimatedCompletionTokens,
      );

      if (cost < lowestCost) {
        lowestCost = cost;
        selectedClient = client;
      }
    }

    return selectedClient;
  }

  private selectHighestPriority(clients: IChatClient[]): IChatClient {
    // Priority order: Groq > OpenRouter
    const priorityOrder = ['groq', 'openrouter'];

    for (const provider of priorityOrder) {
      const client = clients.find((c) => c.provider === provider);
      if (client) {
        return client;
      }
    }

    return clients[0];
  }

  private selectRoundRobin(clients: IChatClient[]): IChatClient {
    const client = clients[this.roundRobinIndex % clients.length];
    this.roundRobinIndex++;
    return client;
  }
}
