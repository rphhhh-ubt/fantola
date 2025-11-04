// Environment loading
export { loadEnv } from './env';

// Base configuration
export {
  getConfig,
  getBaseConfig,
  getDatabaseConfig,
  getRedisUrl,
  getDatabaseUrl,
} from './base-config';

// Service-specific configuration
export { getApiConfig } from './api-config';
export { getBotConfig } from './bot-config';
export { getWorkerConfig } from './worker-config';

// Types
export type {
  BaseConfig,
  DatabaseConfig,
  ApiConfig,
  BotConfig,
  WorkerConfig,
} from './schemas';

// Schemas (for testing and advanced use cases)
export {
  baseConfigSchema,
  databaseConfigSchema,
  apiConfigSchema,
  botConfigSchema,
  storageConfigSchema,
  workerConfigSchema,
} from './schemas';
