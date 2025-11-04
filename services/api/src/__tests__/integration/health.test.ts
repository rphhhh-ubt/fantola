import { buildApp } from '../../app';
import { getApiConfig } from '@monorepo/config';
import { Monitoring } from '@monorepo/monitoring';
import { DatabaseClient } from '@monorepo/shared';

describe('Health Routes', () => {
  let app: any;
  let config: any;
  let monitoring: Monitoring;

  beforeAll(async () => {
    config = getApiConfig();
    monitoring = new Monitoring({ service: 'api-test', environment: 'test' });

    DatabaseClient.initialize({
      logQueries: false,
      onError: () => {},
    });

    app = await buildApp({ config, monitoring });
  });

  afterAll(async () => {
    await app.close();
    await DatabaseClient.disconnect();
  });

  describe('GET /api/v1/health', () => {
    it('should return basic health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        status: 'ok',
        service: 'api',
        version: '1.0.0',
      });
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('uptime');
    });
  });

  describe('GET /api/v1/health/detailed', () => {
    it('should return detailed health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health/detailed',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        status: 'ok',
        service: 'api',
        version: '1.0.0',
      });
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('uptime');
      expect(body).toHaveProperty('database');
      expect(body).toHaveProperty('memory');
      expect(body.database).toHaveProperty('connected');
      expect(body.memory).toHaveProperty('heapUsed');
      expect(body.memory).toHaveProperty('heapTotal');
      expect(body.memory).toHaveProperty('rss');
    });
  });
});
