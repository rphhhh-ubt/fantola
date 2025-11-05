import { describe, expect, it, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Job } from 'bullmq';
import { Monitoring } from '@monorepo/monitoring';
import { db, TokenService, GenerationType } from '@monorepo/shared';
import { BaseProcessor, ProcessorContext, TokenDeductionConfig } from '../processors/base-processor';
import { QueueName, JobResult } from '@monorepo/shared';

class TestProcessor extends BaseProcessor<any> {
  private shouldSucceed: boolean;
  private shouldThrowAfterSuccess: boolean;

  constructor(context: ProcessorContext, shouldSucceed = true, shouldThrowAfterSuccess = false) {
    super(QueueName.IMAGE_GENERATION, context);
    this.shouldSucceed = shouldSucceed;
    this.shouldThrowAfterSuccess = shouldThrowAfterSuccess;
  }

  protected getTokenDeductionConfig(): TokenDeductionConfig {
    return {
      enabled: true,
      operationType: 'image_generation',
      skipDeductionOnFailure: true,
    };
  }

  protected getGenerationType(): GenerationType {
    return GenerationType.CHAT;
  }

  protected async process(job: Job<any>): Promise<JobResult> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (this.shouldThrowAfterSuccess) {
      throw new Error('Processing failed after initial success');
    }

    if (this.shouldSucceed) {
      return {
        success: true,
        data: { result: 'test' },
      };
    }

    return {
      success: false,
      error: { message: 'Test failure' },
    };
  }
}

describe('Token Deduction and Rollback', () => {
  let monitoring: Monitoring;
  let tokenService: TokenService;
  let userId: string;

  beforeAll(async () => {
    monitoring = new Monitoring({
      service: 'worker-test',
      environment: 'test',
    });

    tokenService = new TokenService(db);

    // Create test user with tokens
    const user = await db.user.create({
      data: {
        telegramId: 'test-token-user',
        username: 'tokenuser',
        tier: 'Professional',
        tokensBalance: 100,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    // Clean up
    await db.tokenOperation.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
  });

  beforeEach(async () => {
    // Reset user balance to 100
    await db.user.update({
      where: { id: userId },
      data: {
        tokensBalance: 100,
        tokensSpent: 0,
      },
    });

    // Clean up token operations
    await db.tokenOperation.deleteMany({ where: { userId } });
  });

  describe('Successful Processing with Token Deduction', () => {
    it('should deduct tokens only after successful processing', async () => {
      const processor = new TestProcessor({ monitoring, tokenService }, true);
      const jobProcessor = processor.getProcessor();

      const job = {
        id: 'test-job-success',
        data: {
          userId,
          prompt: 'Test prompt',
          tool: 'dalle',
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
        updateProgress: jest.fn(),
      } as unknown as Job;

      const result = await jobProcessor(job);

      expect(result.success).toBe(true);

      // Verify tokens were deducted
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { tokensBalance: true, tokensSpent: true },
      });

      expect(user?.tokensBalance).toBe(90); // 100 - 10
      expect(user?.tokensSpent).toBe(10);

      // Verify ledger entry
      const ledgerEntries = await db.tokenOperation.findMany({
        where: { userId },
      });

      expect(ledgerEntries).toHaveLength(1);
      expect(ledgerEntries[0].operationType).toBe('image_generation');
      expect(ledgerEntries[0].tokensAmount).toBe(-10);
      expect(ledgerEntries[0].balanceBefore).toBe(100);
      expect(ledgerEntries[0].balanceAfter).toBe(90);
    });

    it('should not deduct tokens on failed processing', async () => {
      const processor = new TestProcessor({ monitoring, tokenService }, false);
      const jobProcessor = processor.getProcessor();

      const job = {
        id: 'test-job-failure',
        data: {
          userId,
          prompt: 'Test prompt',
          tool: 'dalle',
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
        updateProgress: jest.fn(),
      } as unknown as Job;

      const result = await jobProcessor(job);

      expect(result.success).toBe(false);

      // Verify tokens were NOT deducted
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { tokensBalance: true, tokensSpent: true },
      });

      expect(user?.tokensBalance).toBe(100); // No deduction
      expect(user?.tokensSpent).toBe(0);

      // Verify no ledger entries
      const ledgerEntries = await db.tokenOperation.findMany({
        where: { userId },
      });

      expect(ledgerEntries).toHaveLength(0);
    });
  });

  describe('Token Rollback on Processing Failure', () => {
    it('should rollback tokens if processing fails after token deduction', async () => {
      const processor = new TestProcessor({ monitoring, tokenService }, true, true);
      const jobProcessor = processor.getProcessor();

      const job = {
        id: 'test-job-rollback',
        data: {
          userId,
          prompt: 'Test prompt',
          tool: 'dalle',
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
        updateProgress: jest.fn(),
      } as unknown as Job;

      const result = await jobProcessor(job);

      expect(result.success).toBe(false);

      // Verify tokens were rolled back
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { tokensBalance: true, tokensSpent: true },
      });

      expect(user?.tokensBalance).toBe(100); // Rolled back to original
      expect(user?.tokensSpent).toBe(0);

      // Verify ledger entries (debit + refund)
      const ledgerEntries = await db.tokenOperation.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });

      expect(ledgerEntries).toHaveLength(2);

      // First entry: debit
      expect(ledgerEntries[0].operationType).toBe('image_generation');
      expect(ledgerEntries[0].tokensAmount).toBe(-10);
      expect(ledgerEntries[0].balanceBefore).toBe(100);
      expect(ledgerEntries[0].balanceAfter).toBe(90);

      // Second entry: refund (rollback)
      expect(ledgerEntries[1].operationType).toBe('refund');
      expect(ledgerEntries[1].tokensAmount).toBe(10);
      expect(ledgerEntries[1].balanceBefore).toBe(90);
      expect(ledgerEntries[1].balanceAfter).toBe(100);
    });
  });

  describe('Insufficient Balance', () => {
    it('should fail if user has insufficient tokens', async () => {
      // Set user balance to 5 (insufficient for 10 token operation)
      await db.user.update({
        where: { id: userId },
        data: {
          tokensBalance: 5,
        },
      });

      const processor = new TestProcessor({ monitoring, tokenService }, true);
      const jobProcessor = processor.getProcessor();

      const job = {
        id: 'test-job-insufficient',
        data: {
          userId,
          prompt: 'Test prompt',
          tool: 'dalle',
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
        updateProgress: jest.fn(),
      } as unknown as Job;

      const result = await jobProcessor(job);

      // Processing should fail due to insufficient tokens
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Token deduction failed');

      // Verify balance is unchanged
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { tokensBalance: true },
      });

      expect(user?.tokensBalance).toBe(5); // Unchanged
    });
  });

  describe('Token Deduction Disabled', () => {
    it('should not deduct tokens when token deduction is disabled', async () => {
      class NoTokenProcessor extends BaseProcessor<any> {
        constructor(context: ProcessorContext) {
          super(QueueName.IMAGE_GENERATION, context);
        }

        protected getTokenDeductionConfig(): TokenDeductionConfig {
          return {
            enabled: false,
            operationType: 'image_generation',
          };
        }

        protected getGenerationType(): GenerationType {
          return GenerationType.CHAT;
        }

        protected async process(job: Job<any>): Promise<JobResult> {
          return {
            success: true,
            data: { result: 'test' },
          };
        }
      }

      const processor = new NoTokenProcessor({ monitoring, tokenService });
      const jobProcessor = processor.getProcessor();

      const job = {
        id: 'test-job-no-tokens',
        data: {
          userId,
          prompt: 'Test prompt',
          tool: 'dalle',
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
        updateProgress: jest.fn(),
      } as unknown as Job;

      const result = await jobProcessor(job);

      expect(result.success).toBe(true);

      // Verify tokens were NOT deducted
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { tokensBalance: true, tokensSpent: true },
      });

      expect(user?.tokensBalance).toBe(100); // Unchanged
      expect(user?.tokensSpent).toBe(0);

      // Verify no ledger entries
      const ledgerEntries = await db.tokenOperation.findMany({
        where: { userId },
      });

      expect(ledgerEntries).toHaveLength(0);
    });
  });
});
