import { buildApp } from '../../app';
import { getApiConfig } from '@monorepo/config';
import { Monitoring } from '@monorepo/monitoring';
import { DatabaseClient, db } from '@monorepo/shared';

describe('Auth Routes', () => {
  let app: any;
  let config: any;
  let monitoring: Monitoring;
  let testUserId: string;

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
    if (testUserId) {
      await db.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await app.close();
    await DatabaseClient.disconnect();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should create user and return JWT token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          telegramId: 999999999,
          username: 'testuser',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('user');
      expect(body.user).toMatchObject({
        telegramId: 999999999,
        username: 'testuser',
        tier: 'Gift',
      });
      expect(typeof body.token).toBe('string');
      testUserId = body.user.id;
    });

    it('should return existing user on subsequent login', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          telegramId: 999999999,
          username: 'testuser',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.user.id).toBe(testUserId);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    let token: string;

    beforeAll(async () => {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          telegramId: 999999999,
          username: 'testuser',
        },
      });
      const body = JSON.parse(loginResponse.body);
      token = body.token;
    });

    it('should return user info with valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toMatchObject({
        telegramId: 999999999,
        username: 'testuser',
        tier: 'Gift',
      });
      expect(body).toHaveProperty('tokensBalance');
      expect(body).toHaveProperty('tokensSpent');
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toBe('Unauthorized');
    });

    it('should return 401 with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
