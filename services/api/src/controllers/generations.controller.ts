import { FastifyRequest, FastifyReply } from 'fastify';
import { GenerationsService } from '../services/generations.service';
import { GenerationStatus } from '@monorepo/database';
import { GenerationType } from '@monorepo/shared';

export interface ListGenerationsQuery {
  status?: GenerationStatus;
  type?: GenerationType;
  startDate?: string;
  endDate?: string;
  limit?: string;
  offset?: string;
}

export interface GetGenerationParams {
  id: string;
}

export class GenerationsController {
  constructor(private generationsService: GenerationsService) {}

  /**
   * GET /api/v1/generations
   * List generations for the authenticated user
   */
  async listGenerations(
    request: FastifyRequest<{ Querystring: ListGenerationsQuery }>,
    reply: FastifyReply
  ): Promise<void> {
    const userId = (request as any).user.id;
    const { status, type, startDate, endDate, limit, offset } = request.query;

    try {
      const filters: any = {
        userId,
        status,
        type,
        limit: limit ? parseInt(limit) : 50,
        offset: offset ? parseInt(offset) : 0,
      };

      if (startDate) {
        filters.startDate = new Date(startDate);
      }

      if (endDate) {
        filters.endDate = new Date(endDate);
      }

      const result = await this.generationsService.listGenerations(filters);

      reply.send({
        success: true,
        data: result,
      });
    } catch (error) {
      request.log.error({ error, userId }, 'Failed to list generations');
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch generations',
      });
    }
  }

  /**
   * GET /api/v1/generations/:id
   * Get a single generation by ID
   */
  async getGeneration(
    request: FastifyRequest<{ Params: GetGenerationParams }>,
    reply: FastifyReply
  ): Promise<void> {
    const userId = (request as any).user.id;
    const { id } = request.params;

    try {
      const generation = await this.generationsService.getGeneration(id);

      if (!generation) {
        return reply.code(404).send({
          success: false,
          error: 'Generation not found',
        });
      }

      // Check if user owns this generation
      if (generation.userId !== userId) {
        return reply.code(403).send({
          success: false,
          error: 'Access denied',
        });
      }

      reply.send({
        success: true,
        data: generation,
      });
    } catch (error) {
      request.log.error({ error, userId, generationId: id }, 'Failed to get generation');
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch generation',
      });
    }
  }
}
