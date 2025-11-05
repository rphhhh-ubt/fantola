import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';
import { FastifyInstance } from 'fastify';
import { StatusSubscriber, REDIS_CHANNELS } from '@monorepo/shared';
import Redis from 'ioredis';

/**
 * WebSocket plugin for real-time status updates
 * Subscribes to Redis pub/sub and broadcasts to connected WebSocket clients
 */
export default fp(
  async (fastify: FastifyInstance, opts: { redis: Redis }) => {
    // Register WebSocket support
    await fastify.register(websocket);

    // Create status subscriber
    const statusSubscriber = new StatusSubscriber(opts.redis);

    // Store active WebSocket connections per user
    const userConnections = new Map<string, Set<any>>();

    // Subscribe to all status updates and broadcast to relevant clients
    await statusSubscriber.subscribeAll(async (payload) => {
      fastify.log.debug(
        {
          generationId: payload.generationId,
          userId: payload.userId,
          status: payload.status,
        },
        'Broadcasting status update to WebSocket clients'
      );

      // Send to user-specific connections
      const connections = userConnections.get(payload.userId);
      if (connections) {
        const message = JSON.stringify({
          type: 'status_update',
          payload,
        });

        connections.forEach((socket) => {
          try {
            if (socket.readyState === 1) {
              // OPEN state
              socket.send(message);
            }
          } catch (error) {
            fastify.log.error({ error }, 'Failed to send WebSocket message');
          }
        });
      }
    });

    // WebSocket route for status updates
    fastify.get(
      '/ws/status',
      { websocket: true },
      (connection, request) => {
        const userId = (request as any).user?.id;

        if (!userId) {
          connection.socket.close(4401, 'Unauthorized');
          return;
        }

        fastify.log.info({ userId }, 'WebSocket connection established');

        // Add connection to user's set
        if (!userConnections.has(userId)) {
          userConnections.set(userId, new Set());
        }
        userConnections.get(userId)!.add(connection.socket);

        // Handle connection close
        connection.socket.on('close', () => {
          fastify.log.info({ userId }, 'WebSocket connection closed');

          const connections = userConnections.get(userId);
          if (connections) {
            connections.delete(connection.socket);
            if (connections.size === 0) {
              userConnections.delete(userId);
            }
          }
        });

        // Handle errors
        connection.socket.on('error', (error) => {
          fastify.log.error({ userId, error }, 'WebSocket error');
        });

        // Send initial connection success message
        connection.socket.send(
          JSON.stringify({
            type: 'connected',
            payload: {
              userId,
              timestamp: Date.now(),
            },
          })
        );
      }
    );

    // Cleanup on server close
    fastify.addHook('onClose', async () => {
      await statusSubscriber.close();
      userConnections.clear();
    });

    // Decorate fastify instance with subscriber for potential use in routes
    fastify.decorate('statusSubscriber', statusSubscriber);
  },
  {
    name: 'websocket',
  }
);
