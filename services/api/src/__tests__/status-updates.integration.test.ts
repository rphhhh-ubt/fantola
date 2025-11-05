import { buildApp } from '../app';
import { Monitoring } from '@monorepo/monitoring';
import { getApiConfig } from '@monorepo/config';
import {
  setupTestDatabase,
  teardownTestDatabase,
  createTestUser,
} from '@monorepo/test-utils';
import { db } from '@monorepo/database';
import { StatusPublisher, StatusSubscriber } from '@monorepo/shared';
import Redis from 'ioredis';
import WebSocket from 'ws';

describe('Status Updates Integration Tests', () => {
  let app: any;
  let monitoring: Monitoring;
  let config: any;
  let redis: Redis;
  let pubsubRedis: Redis;
  let statusPublisher: StatusPublisher;
  let statusSubscriber: StatusSubscriber;
  let testUserId: string;
  let authToken: string;

  beforeAll(async () => {
    await setupTestDatabase();

    config = getApiConfig();
    monitoring = new Monitoring({ service: 'api-test' });

    // Create Redis connections
    redis = new Redis({
      host: config.redisHost,
      port: config.redisPort,
      password: config.redisPassword,
    });

    pubsubRedis = new Redis({
      host: config.redisHost,
      port: config.redisPort,
      password: config.redisPassword,
    });

    // Initialize pub/sub
    statusPublisher = new StatusPublisher(redis);
    statusSubscriber = new StatusSubscriber(pubsubRedis);

    // Build app
    app = await buildApp({ config, monitoring, redis });
    await app.ready();

    // Create test user and get auth token
    const user = await createTestUser(db);
    testUserId = user.id;

    // Generate JWT token
    authToken = app.jwt.sign({ id: user.id, telegramId: user.telegramId });
  });

  afterAll(async () => {
    await statusPublisher.close();
    await statusSubscriber.close();
    await app.close();
    await redis.quit();
    await pubsubRedis.quit();
    await teardownTestDatabase();
  });

  describe('Redis Pub/Sub', () => {
    it('should publish and receive status updates', async () => {
      const received: any[] = [];

      // Subscribe to user updates
      await statusSubscriber.subscribeUser(testUserId, (payload) => {
        received.push(payload);
      });

      // Publish a status update
      await statusPublisher.publishStatusUpdate({
        generationId: 'test-gen-id',
        userId: testUserId,
        type: 'product_card',
        status: 'pending',
        timestamp: Date.now(),
        metadata: {
          tool: 'product_card',
          prompt: 'Test prompt',
        },
      });

      // Wait for message to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(received).toHaveLength(1);
      expect(received[0].generationId).toBe('test-gen-id');
      expect(received[0].userId).toBe(testUserId);
      expect(received[0].status).toBe('pending');
    });

    it('should publish to multiple channels', async () => {
      const allReceived: any[] = [];
      const userReceived: any[] = [];

      // Subscribe to all updates
      await statusSubscriber.subscribeAll((payload) => {
        allReceived.push(payload);
      });

      // Subscribe to user-specific updates
      await statusSubscriber.subscribeUser(testUserId, (payload) => {
        userReceived.push(payload);
      });

      // Publish update
      await statusPublisher.publishStatusUpdate({
        generationId: 'test-gen-id-2',
        userId: testUserId,
        type: 'sora',
        status: 'processing',
        timestamp: Date.now(),
      });

      // Wait for propagation
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(allReceived.length).toBeGreaterThanOrEqual(1);
      expect(userReceived.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('REST API Endpoints', () => {
    let generationId: string;

    beforeAll(async () => {
      // Create test generation
      const generation = await db.productCardGeneration.create({
        data: {
          userId: testUserId,
          status: 'completed',
          productImageUrl: 'https://example.com/image.jpg',
          productImageKey: 'test-key',
          mode: 'clean',
          resultUrls: ['https://example.com/result.jpg'],
          tokensUsed: 10,
        },
      });
      generationId = generation.id;
    });

    it('should list generations for authenticated user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/generations',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('items');
      expect(Array.isArray(body.data.items)).toBe(true);
      expect(body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter generations by status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/generations?status=completed',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.items.every((item: any) => item.status === 'completed')).toBe(true);
    });

    it('should filter generations by type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/generations?type=product_card',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.items.every((item: any) => item.type === 'product_card')).toBe(true);
    });

    it('should get a single generation by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/generations/${generationId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(generationId);
      expect(body.data.userId).toBe(testUserId);
    });

    it('should return 404 for non-existent generation', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/generations/non-existent-id',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/generations',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should support pagination', async () => {
      // Create more test generations
      for (let i = 0; i < 5; i++) {
        await db.soraGeneration.create({
          data: {
            userId: testUserId,
            status: 'completed',
            prompt: `Test prompt ${i}`,
            resultUrls: [],
            tokensUsed: 10,
          },
        });
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/generations?limit=2&offset=0',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.items.length).toBeLessThanOrEqual(2);
      expect(body.data.limit).toBe(2);
      expect(body.data.offset).toBe(0);
    });
  });

  describe('WebSocket Gateway', () => {
    it('should establish WebSocket connection with valid auth', (done) => {
      const port = config.apiPort;
      const ws = new WebSocket(`ws://localhost:${port}/ws/status`, {
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      ws.on('open', () => {
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    }, 10000);

    it('should receive status updates via WebSocket', (done) => {
      const port = config.apiPort;
      const ws = new WebSocket(`ws://localhost:${port}/ws/status`, {
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      ws.on('message', async (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'connected') {
          // Send a status update via pub/sub
          await statusPublisher.publishStatusUpdate({
            generationId: 'ws-test-gen-id',
            userId: testUserId,
            type: 'product_card',
            status: 'processing',
            timestamp: Date.now(),
            metadata: {
              tool: 'product_card',
            },
          });
        } else if (message.type === 'status_update') {
          expect(message.payload.generationId).toBe('ws-test-gen-id');
          expect(message.payload.userId).toBe(testUserId);
          expect(message.payload.status).toBe('processing');
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        ws.close();
        done(error);
      });

      setTimeout(() => {
        ws.close();
        done(new Error('Timeout waiting for WebSocket message'));
      }, 5000);
    }, 10000);

    it('should handle multiple concurrent WebSocket connections', async () => {
      const port = config.apiPort;
      const connections: WebSocket[] = [];
      const receivedMessages: any[][] = [[], [], []];

      // Create 3 connections
      for (let i = 0; i < 3; i++) {
        const ws = new WebSocket(`ws://localhost:${port}/ws/status`, {
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        });

        const index = i;
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'status_update') {
            receivedMessages[index].push(message);
          }
        });

        connections.push(ws);
      }

      // Wait for connections to establish
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Send status update
      await statusPublisher.publishStatusUpdate({
        generationId: 'multi-ws-test',
        userId: testUserId,
        type: 'sora',
        status: 'completed',
        timestamp: Date.now(),
      });

      // Wait for messages to propagate
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Close connections
      connections.forEach((ws) => ws.close());

      // Verify all connections received the message
      receivedMessages.forEach((messages) => {
        expect(messages.length).toBeGreaterThanOrEqual(1);
      });
    }, 15000);
  });

  describe('End-to-End Status Flow', () => {
    it('should track complete generation lifecycle', async () => {
      const updates: any[] = [];

      // Subscribe to status updates
      await statusSubscriber.subscribeUser(testUserId, (payload) => {
        updates.push(payload);
      });

      // Simulate complete generation lifecycle
      const generationId = 'lifecycle-test-gen';

      // 1. Pending
      await statusPublisher.publishStatusUpdate({
        generationId,
        userId: testUserId,
        type: 'product_card',
        status: 'pending',
        timestamp: Date.now(),
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // 2. Processing
      await statusPublisher.publishStatusUpdate({
        generationId,
        userId: testUserId,
        type: 'product_card',
        status: 'processing',
        timestamp: Date.now(),
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // 3. Completed
      await statusPublisher.publishStatusUpdate({
        generationId,
        userId: testUserId,
        type: 'product_card',
        status: 'completed',
        timestamp: Date.now(),
        metadata: {
          resultUrls: ['https://example.com/result.jpg'],
          tokensUsed: 10,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify lifecycle
      expect(updates.length).toBeGreaterThanOrEqual(3);
      expect(updates[0].status).toBe('pending');
      expect(updates[1].status).toBe('processing');
      expect(updates[2].status).toBe('completed');
      expect(updates[2].metadata?.resultUrls).toBeDefined();
    });
  });
});
