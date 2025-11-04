import { FastifyRequest } from 'fastify';
import { PrismaClient } from '@monorepo/database';
import { Monitoring } from '@monorepo/monitoring';

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    userId: string;
    telegramId: number;
    username?: string;
    tier: string;
  };
}

declare module 'fastify' {
  interface FastifyInstance {
    db: PrismaClient;
    monitoring: Monitoring;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
