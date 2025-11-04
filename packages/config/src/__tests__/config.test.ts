import {
  getConfig,
  getBaseConfig,
  getApiConfig,
  getBotConfig,
  getWorkerConfig,
  getRedisUrl,
  getDatabaseUrl,
} from '../index';

describe('Config Package', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getBaseConfig', () => {
    it('should return default config when no env vars are set', () => {
      delete process.env.NODE_ENV;
      delete process.env.PORT;

      const config = getBaseConfig();

      expect(config.nodeEnv).toBe('development');
      expect(config.port).toBe(3000);
      expect(config.logLevel).toBe('info');
      expect(config.enableMetrics).toBe(false);
      expect(config.metricsPort).toBe(9091);
      expect(config.redisHost).toBe('localhost');
      expect(config.redisPort).toBe(6379);
    });

    it('should use environment variables', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8080';
      process.env.LOG_LEVEL = 'debug';
      process.env.ENABLE_METRICS = 'true';
      process.env.REDIS_HOST = 'redis-server';
      process.env.REDIS_PORT = '6380';

      const config = getBaseConfig();

      expect(config.nodeEnv).toBe('production');
      expect(config.port).toBe(8080);
      expect(config.logLevel).toBe('debug');
      expect(config.enableMetrics).toBe(true);
      expect(config.redisHost).toBe('redis-server');
      expect(config.redisPort).toBe(6380);
    });

    it('should parse numeric values correctly', () => {
      process.env.PORT = '5000';
      process.env.METRICS_PORT = '9092';

      const config = getBaseConfig();

      expect(config.port).toBe(5000);
      expect(typeof config.port).toBe('number');
      expect(config.metricsPort).toBe(9092);
      expect(typeof config.metricsPort).toBe('number');
    });

    it('should parse boolean values correctly', () => {
      process.env.ENABLE_METRICS = 'true';
      process.env.SENTRY_ENABLED = 'true';

      const config = getBaseConfig();

      expect(config.enableMetrics).toBe(true);
      expect(config.sentryEnabled).toBe(true);
    });

    it('should handle Sentry configuration', () => {
      process.env.SENTRY_ENABLED = 'true';
      process.env.SENTRY_DSN = 'https://example@sentry.io/123';
      process.env.SENTRY_TRACES_SAMPLE_RATE = '0.5';

      const config = getBaseConfig();

      expect(config.sentryEnabled).toBe(true);
      expect(config.sentryDsn).toBe('https://example@sentry.io/123');
      expect(config.sentryTracesSampleRate).toBe(0.5);
    });
  });

  describe('getApiConfig', () => {
    it('should include API-specific configuration', () => {
      process.env.JWT_SECRET = 'test-secret';
      process.env.API_PORT = '4000';
      process.env.API_BASE_URL = 'https://api.example.com';

      const config = getApiConfig();

      expect(config.jwtSecret).toBe('test-secret');
      expect(config.apiPort).toBe(4000);
      expect(config.apiBaseUrl).toBe('https://api.example.com');
    });

    it('should include database configuration', () => {
      process.env.JWT_SECRET = 'test-secret';
      process.env.POSTGRES_HOST = 'db.example.com';
      process.env.POSTGRES_PORT = '5433';
      process.env.POSTGRES_DB = 'testdb';

      const config = getApiConfig();

      expect(config.postgresHost).toBe('db.example.com');
      expect(config.postgresPort).toBe(5433);
      expect(config.postgresDb).toBe('testdb');
    });

    it('should throw error if JWT_SECRET is missing', () => {
      process.env.JWT_SECRET = '';

      expect(() => getApiConfig()).toThrow('API configuration validation failed');
    });
  });

  describe('getBotConfig', () => {
    it('should include bot-specific configuration', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'bot-token-123';
      process.env.TELEGRAM_WEBHOOK_DOMAIN = 'example.com';
      process.env.TELEGRAM_WEBHOOK_PATH = '/webhook/tg';

      const config = getBotConfig();

      expect(config.telegramBotToken).toBe('bot-token-123');
      expect(config.telegramWebhookDomain).toBe('example.com');
      expect(config.telegramWebhookPath).toBe('/webhook/tg');
    });

    it('should include YooKassa configuration', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'bot-token-123';
      process.env.YOOKASSA_SHOP_ID = 'shop-123';
      process.env.YOOKASSA_SECRET_KEY = 'secret-key';

      const config = getBotConfig();

      expect(config.yookassaShopId).toBe('shop-123');
      expect(config.yookassaSecretKey).toBe('secret-key');
    });

    it('should throw error if TELEGRAM_BOT_TOKEN is missing', () => {
      process.env.TELEGRAM_BOT_TOKEN = '';

      expect(() => getBotConfig()).toThrow('Bot configuration validation failed');
    });
  });

  describe('getWorkerConfig', () => {
    it('should include worker-specific configuration', () => {
      process.env.WORKER_CONCURRENCY = '10';
      process.env.WORKER_REPLICAS = '3';
      process.env.WORKER_MAX_JOBS_PER_WORKER = '100';

      const config = getWorkerConfig();

      expect(config.workerConcurrency).toBe(10);
      expect(config.workerReplicas).toBe(3);
      expect(config.workerMaxJobsPerWorker).toBe(100);
    });

    it('should include storage configuration', () => {
      process.env.STORAGE_TYPE = 's3';
      process.env.STORAGE_BASE_URL = 'https://cdn.example.com';
      process.env.S3_BUCKET = 'my-bucket';
      process.env.S3_REGION = 'eu-west-1';

      const config = getWorkerConfig();

      expect(config.storageType).toBe('s3');
      expect(config.storageBaseUrl).toBe('https://cdn.example.com');
      expect(config.s3Bucket).toBe('my-bucket');
      expect(config.s3Region).toBe('eu-west-1');
    });

    it('should use default storage type', () => {
      delete process.env.STORAGE_TYPE;

      const config = getWorkerConfig();

      expect(config.storageType).toBe('local');
    });
  });

  describe('getRedisUrl', () => {
    it('should use REDIS_URL if provided', () => {
      process.env.REDIS_URL = 'redis://custom-url:6379';

      const config = getBaseConfig();
      const redisUrl = getRedisUrl(config);

      expect(redisUrl).toBe('redis://custom-url:6379');
    });

    it('should construct URL from components without password', () => {
      delete process.env.REDIS_URL;
      delete process.env.REDIS_PASSWORD;
      process.env.REDIS_HOST = 'redis-host';
      process.env.REDIS_PORT = '6380';

      const config = getBaseConfig();
      const redisUrl = getRedisUrl(config);

      expect(redisUrl).toBe('redis://redis-host:6380');
    });

    it('should construct URL from components with password', () => {
      delete process.env.REDIS_URL;
      process.env.REDIS_HOST = 'redis-host';
      process.env.REDIS_PORT = '6379';
      process.env.REDIS_PASSWORD = 'secret';

      const config = getBaseConfig();
      const redisUrl = getRedisUrl(config);

      expect(redisUrl).toBe('redis://:secret@redis-host:6379');
    });
  });

  describe('getDatabaseUrl', () => {
    it('should use DATABASE_URL if provided', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@host:5432/db';

      const dbUrl = getDatabaseUrl({
        postgresHost: 'localhost',
        postgresPort: 5432,
        postgresDb: 'test',
        postgresUser: 'user',
        postgresPassword: 'pass',
        databaseUrl: process.env.DATABASE_URL,
      });

      expect(dbUrl).toBe('postgresql://user:pass@host:5432/db');
    });

    it('should construct URL from components', () => {
      delete process.env.DATABASE_URL;

      const dbUrl = getDatabaseUrl({
        postgresHost: 'db-host',
        postgresPort: 5433,
        postgresDb: 'mydb',
        postgresUser: 'myuser',
        postgresPassword: 'mypass',
      });

      expect(dbUrl).toBe('postgresql://myuser:mypass@db-host:5433/mydb');
    });
  });

  describe('getConfig (legacy)', () => {
    it('should work for backward compatibility', () => {
      process.env.NODE_ENV = 'test';

      const config = getConfig();

      expect(config.nodeEnv).toBe('test');
    });
  });
});
