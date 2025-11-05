import { PrismaClient, GenerationStatus, GenerationTool } from '@monorepo/database';
import { GenerationType } from '@monorepo/shared';

export interface GenerationFilters {
  userId?: string;
  status?: GenerationStatus;
  type?: GenerationType;
  tool?: GenerationTool;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface GenerationListItem {
  id: string;
  userId: string;
  type: GenerationType;
  status: GenerationStatus;
  prompt?: string;
  resultUrls: string[];
  errorMessage?: string;
  tokensUsed: number;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: any;
}

export interface GenerationListResult {
  items: GenerationListItem[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Service for querying generation history across all generation types
 */
export class GenerationsService {
  constructor(private db: PrismaClient) {}

  /**
   * List generations with filters
   */
  async listGenerations(filters: GenerationFilters): Promise<GenerationListResult> {
    const limit = Math.min(filters.limit || 50, 100);
    const offset = filters.offset || 0;

    const results: GenerationListItem[] = [];

    // Query different generation types based on filters
    const shouldQueryType = (type: GenerationType) =>
      !filters.type || filters.type === type;

    // Query product card generations
    if (shouldQueryType(GenerationType.PRODUCT_CARD)) {
      const where: any = {};
      if (filters.userId) where.userId = filters.userId;
      if (filters.status) where.status = filters.status;
      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
      }

      const productCards = await this.db.productCardGeneration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      results.push(
        ...productCards.map((gen) => ({
          id: gen.id,
          userId: gen.userId,
          type: GenerationType.PRODUCT_CARD,
          status: gen.status,
          prompt: `Product card: ${gen.mode}`,
          resultUrls: gen.resultUrls,
          errorMessage: gen.errorMessage || undefined,
          tokensUsed: gen.tokensUsed,
          createdAt: gen.createdAt,
          updatedAt: gen.updatedAt,
          startedAt: gen.startedAt || undefined,
          completedAt: gen.completedAt || undefined,
          metadata: gen.metadata,
        }))
      );
    }

    // Query sora generations
    if (shouldQueryType(GenerationType.SORA)) {
      const where: any = {};
      if (filters.userId) where.userId = filters.userId;
      if (filters.status) where.status = filters.status;
      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
      }

      const soraGens = await this.db.soraGeneration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      results.push(
        ...soraGens.map((gen) => ({
          id: gen.id,
          userId: gen.userId,
          type: GenerationType.SORA,
          status: gen.status,
          prompt: gen.prompt,
          resultUrls: gen.resultUrls,
          errorMessage: gen.errorMessage || undefined,
          tokensUsed: gen.tokensUsed,
          createdAt: gen.createdAt,
          updatedAt: gen.updatedAt,
          startedAt: gen.startedAt || undefined,
          completedAt: gen.completedAt || undefined,
          metadata: gen.metadata,
        }))
      );
    }

    // Query chat/image generations
    if (shouldQueryType(GenerationType.CHAT)) {
      const where: any = {};
      if (filters.userId) where.userId = filters.userId;
      if (filters.status) where.status = filters.status;
      if (filters.tool) where.tool = filters.tool;
      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        if (filters.startDate) where.createdAt.gte = filters.startDate;
        if (filters.endDate) where.createdAt.lte = filters.endDate;
      }

      const generations = await this.db.generation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      results.push(
        ...generations.map((gen) => ({
          id: gen.id,
          userId: gen.userId,
          type: GenerationType.CHAT,
          status: gen.status,
          prompt: gen.prompt,
          resultUrls: gen.resultUrls,
          errorMessage: gen.errorMessage || undefined,
          tokensUsed: gen.tokensUsed,
          createdAt: gen.createdAt,
          updatedAt: gen.updatedAt,
          startedAt: gen.startedAt || undefined,
          completedAt: gen.completedAt || undefined,
          metadata: gen.metadata,
        }))
      );
    }

    // Sort all results by createdAt desc
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      items: paginatedResults,
      total: results.length,
      limit,
      offset,
    };
  }

  /**
   * Get a single generation by ID
   */
  async getGeneration(generationId: string): Promise<GenerationListItem | null> {
    // Try product card
    const productCard = await this.db.productCardGeneration.findUnique({
      where: { id: generationId },
    });

    if (productCard) {
      return {
        id: productCard.id,
        userId: productCard.userId,
        type: GenerationType.PRODUCT_CARD,
        status: productCard.status,
        prompt: `Product card: ${productCard.mode}`,
        resultUrls: productCard.resultUrls,
        errorMessage: productCard.errorMessage || undefined,
        tokensUsed: productCard.tokensUsed,
        createdAt: productCard.createdAt,
        updatedAt: productCard.updatedAt,
        startedAt: productCard.startedAt || undefined,
        completedAt: productCard.completedAt || undefined,
        metadata: productCard.metadata,
      };
    }

    // Try sora
    const sora = await this.db.soraGeneration.findUnique({
      where: { id: generationId },
    });

    if (sora) {
      return {
        id: sora.id,
        userId: sora.userId,
        type: GenerationType.SORA,
        status: sora.status,
        prompt: sora.prompt,
        resultUrls: sora.resultUrls,
        errorMessage: sora.errorMessage || undefined,
        tokensUsed: sora.tokensUsed,
        createdAt: sora.createdAt,
        updatedAt: sora.updatedAt,
        startedAt: sora.startedAt || undefined,
        completedAt: sora.completedAt || undefined,
        metadata: sora.metadata,
      };
    }

    // Try chat/image generation
    const generation = await this.db.generation.findUnique({
      where: { id: generationId },
    });

    if (generation) {
      return {
        id: generation.id,
        userId: generation.userId,
        type: GenerationType.CHAT,
        status: generation.status,
        prompt: generation.prompt,
        resultUrls: generation.resultUrls,
        errorMessage: generation.errorMessage || undefined,
        tokensUsed: generation.tokensUsed,
        createdAt: generation.createdAt,
        updatedAt: generation.updatedAt,
        startedAt: generation.startedAt || undefined,
        completedAt: generation.completedAt || undefined,
        metadata: generation.metadata,
      };
    }

    return null;
  }
}
