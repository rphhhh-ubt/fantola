import type {
  IImageClient,
  ProviderSelectionOptions,
  ImageProvider,
  ProviderConfig,
} from '../types';
import { SelectionStrategy } from '../types';

/**
 * Provider selector for image generation
 * Implements various selection strategies and failover logic
 */
export class ProviderSelector {
  private readonly clients: Map<ImageProvider, IImageClient>;
  private readonly configs: Map<ImageProvider, ProviderConfig>;
  private roundRobinIndex = 0;

  constructor(clients: IImageClient[], configs: ProviderConfig[]) {
    this.clients = new Map();
    this.configs = new Map();

    clients.forEach((client) => {
      this.clients.set(client.provider, client);
    });

    configs.forEach((config) => {
      this.configs.set(config.provider, config);
    });
  }

  /**
   * Select a provider based on the given strategy
   */
  async selectProvider(options: ProviderSelectionOptions = {}): Promise<IImageClient | null> {
    const strategy = options.strategy || SelectionStrategy.FAILOVER;
    const excludeProviders = new Set(options.excludeProviders || []);

    // Filter enabled and non-excluded providers
    const availableClients = Array.from(this.clients.values()).filter((client) => {
      const config = this.configs.get(client.provider);
      return config?.enabled && !excludeProviders.has(client.provider);
    });

    if (availableClients.length === 0) {
      return null;
    }

    switch (strategy) {
      case SelectionStrategy.LOWEST_COST:
        return this.selectLowestCost(availableClients, options.model);
      case SelectionStrategy.HIGHEST_PRIORITY:
        return this.selectHighestPriority(availableClients);
      case SelectionStrategy.ROUND_ROBIN:
        return this.selectRoundRobin(availableClients);
      case SelectionStrategy.FAILOVER:
        return this.selectHighestPriority(availableClients);
      default:
        return availableClients[0] || null;
    }
  }

  /**
   * Get all providers in failover order
   */
  async getFailoverOrder(options: ProviderSelectionOptions = {}): Promise<IImageClient[]> {
    const excludeProviders = new Set(options.excludeProviders || []);

    const availableClients = Array.from(this.clients.values()).filter((client) => {
      const config = this.configs.get(client.provider);
      return config?.enabled && !excludeProviders.has(client.provider);
    });

    // Sort by priority (higher priority first)
    return availableClients.sort((a, b) => {
      const priorityA = this.configs.get(a.provider)?.priority || 0;
      const priorityB = this.configs.get(b.provider)?.priority || 0;
      return priorityB - priorityA;
    });
  }

  /**
   * Check if a model is supported by a provider
   */
  isModelSupported(provider: ImageProvider, model: string): boolean {
    const config = this.configs.get(provider);
    if (!config) return false;

    return config.models.includes(model) || config.models.includes('*');
  }

  /**
   * Get all providers that support a specific model
   */
  getProvidersForModel(model: string): IImageClient[] {
    return Array.from(this.clients.values()).filter((client) =>
      this.isModelSupported(client.provider, model),
    );
  }

  private selectLowestCost(clients: IImageClient[], model?: string): IImageClient | null {
    if (!model) {
      return clients[0] || null;
    }

    // Estimate cost for 1024x1024 single image
    const costsWithClients = clients
      .map((client) => ({
        client,
        cost: client.estimateCost(model, 1024, 1024, 1),
      }))
      .sort((a, b) => a.cost - b.cost);

    return costsWithClients[0]?.client || null;
  }

  private selectHighestPriority(clients: IImageClient[]): IImageClient | null {
    const clientsWithPriority = clients
      .map((client) => ({
        client,
        priority: this.configs.get(client.provider)?.priority || 0,
      }))
      .sort((a, b) => b.priority - a.priority);

    return clientsWithPriority[0]?.client || null;
  }

  private selectRoundRobin(clients: IImageClient[]): IImageClient | null {
    if (clients.length === 0) {
      return null;
    }

    const client = clients[this.roundRobinIndex % clients.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % clients.length;

    return client || null;
  }
}
