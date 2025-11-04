import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';

/**
 * Redis connection configuration
 */
export interface RedisConnectionConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  url?: string;
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
  enableOfflineQueue?: boolean;
  lazyConnect?: boolean;
}

/**
 * Default Redis connection options
 */
const DEFAULT_REDIS_OPTIONS: Partial<RedisOptions> = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: true,
  lazyConnect: false,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err: Error) => {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
    return targetErrors.some((targetError) => err.message.includes(targetError));
  },
};

/**
 * Factory for creating Redis connections for BullMQ
 */
export class RedisConnectionFactory {
  private static connections: Map<string, Redis> = new Map();
  private static defaultConfig: RedisConnectionConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  };

  /**
   * Set default Redis connection configuration
   */
  static setDefaultConfig(config: RedisConnectionConfig): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  /**
   * Create or get a Redis connection
   */
  static createConnection(
    name: string = 'default',
    config?: RedisConnectionConfig,
  ): Redis {
    const connectionKey = `${name}-${JSON.stringify(config || this.defaultConfig)}`;

    if (this.connections.has(connectionKey)) {
      return this.connections.get(connectionKey)!;
    }

    const finalConfig = config || this.defaultConfig;
    let redis: Redis;

    if (finalConfig.url) {
      redis = new Redis(finalConfig.url, {
        ...DEFAULT_REDIS_OPTIONS,
        maxRetriesPerRequest: finalConfig.maxRetriesPerRequest ?? null,
      });
    } else {
      redis = new Redis({
        host: finalConfig.host,
        port: finalConfig.port,
        password: finalConfig.password,
        db: finalConfig.db,
        ...DEFAULT_REDIS_OPTIONS,
        maxRetriesPerRequest: finalConfig.maxRetriesPerRequest ?? null,
      });
    }

    redis.on('error', (err) => {
      console.error(`Redis connection error (${name}):`, err);
    });

    redis.on('connect', () => {
      console.log(`Redis connected (${name})`);
    });

    redis.on('ready', () => {
      console.log(`Redis ready (${name})`);
    });

    redis.on('close', () => {
      console.log(`Redis connection closed (${name})`);
    });

    this.connections.set(connectionKey, redis);
    return redis;
  }

  /**
   * Get existing connection by name
   */
  static getConnection(name: string = 'default'): Redis | undefined {
    for (const [key, connection] of this.connections.entries()) {
      if (key.startsWith(`${name}-`)) {
        return connection;
      }
    }
    return undefined;
  }

  /**
   * Close a specific connection
   */
  static async closeConnection(name: string = 'default'): Promise<void> {
    const keysToClose: string[] = [];

    for (const key of this.connections.keys()) {
      if (key.startsWith(`${name}-`)) {
        keysToClose.push(key);
      }
    }

    for (const key of keysToClose) {
      const connection = this.connections.get(key);
      if (connection) {
        await connection.quit();
        this.connections.delete(key);
      }
    }
  }

  /**
   * Close all connections
   */
  static async closeAllConnections(): Promise<void> {
    const closePromises = Array.from(this.connections.values()).map((connection) =>
      connection.quit(),
    );

    await Promise.all(closePromises);
    this.connections.clear();
  }

  /**
   * Get the number of active connections
   */
  static getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Check if a connection exists
   */
  static hasConnection(name: string = 'default'): boolean {
    for (const key of this.connections.keys()) {
      if (key.startsWith(`${name}-`)) {
        return true;
      }
    }
    return false;
  }
}

/**
 * Create a shared Redis connection for BullMQ
 * This ensures all queues and workers share the same connection
 */
export function createRedisConnection(config?: RedisConnectionConfig): Redis {
  return RedisConnectionFactory.createConnection('default', config);
}

/**
 * Close all Redis connections
 */
export async function closeRedisConnections(): Promise<void> {
  await RedisConnectionFactory.closeAllConnections();
}
