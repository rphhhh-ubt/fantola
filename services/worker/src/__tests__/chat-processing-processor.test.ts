import { describe, expect, it, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { Job } from 'bullmq';
import { Monitoring } from '@monorepo/monitoring';
import { db } from '@monorepo/shared';
import { ChatProcessingProcessor } from '../processors/chat-processing-processor';

describe('ChatProcessingProcessor', () => {
  let processor: ChatProcessingProcessor;
  let monitoring: Monitoring;
  let userId: string;

  beforeAll(async () => {
    monitoring = new Monitoring({
      service: 'worker-test',
      environment: 'test',
    });

    processor = new ChatProcessingProcessor({
      monitoring,
    });

    // Create test user
    const user = await db.user.create({
      data: {
        telegramId: 'test-chat-user',
        username: 'chattestuser',
        tier: 'Professional',
        tokensBalance: 1000,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    // Clean up
    await db.chatMessage.deleteMany({ where: { userId } });
    await db.tokenOperation.deleteMany({ where: { userId } });
    await db.user.delete({ where: { id: userId } });
  });

  beforeEach(async () => {
    // Reset user balance
    await db.user.update({
      where: { id: userId },
      data: {
        tokensBalance: 1000,
        tokensSpent: 0,
      },
    });

    // Clean up existing chat messages
    await db.chatMessage.deleteMany({ where: { userId } });
    await db.tokenOperation.deleteMany({ where: { userId } });
  });

  describe('process', () => {
    it('should successfully process a chat job', async () => {
      const job = {
        id: 'test-job-chat',
        data: {
          userId,
          message: 'Hello, how are you?',
          conversationId: 'conv-123',
          model: 'gpt-4',
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
        updateProgress: jest.fn(),
      } as unknown as Job;

      const jobProcessor = processor.getProcessor();
      const result = await jobProcessor(job);

      expect(result.success).toBe(true);
      expect(result.data?.userMessageId).toBeDefined();
      expect(result.data?.assistantMessageId).toBeDefined();
      expect(result.data?.response).toBeDefined();

      // Verify messages were stored
      const messages = await db.chatMessage.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Hello, how are you?');
      expect(messages[1].role).toBe('assistant');

      // Verify tokens were deducted
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { tokensBalance: true, tokensSpent: true },
      });

      expect(user?.tokensBalance).toBe(995); // 1000 - 5
      expect(user?.tokensSpent).toBe(5);
    });

    it('should handle conversation context', async () => {
      const conversationId = 'conv-test-123';

      // First message
      const job1 = {
        id: 'test-job-chat-1',
        data: {
          userId,
          message: 'What is the weather?',
          conversationId,
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
        updateProgress: jest.fn(),
      } as unknown as Job;

      const jobProcessor = processor.getProcessor();
      await jobProcessor(job1);

      // Second message in same conversation
      const job2 = {
        id: 'test-job-chat-2',
        data: {
          userId,
          message: 'And tomorrow?',
          conversationId,
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
        updateProgress: jest.fn(),
      } as unknown as Job;

      await jobProcessor(job2);

      // Verify messages are in the same conversation
      const messages = await db.chatMessage.findMany({
        where: {
          userId,
          conversationId,
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(messages).toHaveLength(4); // 2 user + 2 assistant messages
      expect(messages.every((msg) => msg.conversationId === conversationId)).toBe(true);

      // Verify tokens were deducted for both messages
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { tokensBalance: true, tokensSpent: true },
      });

      expect(user?.tokensBalance).toBe(990); // 1000 - 10 (2 messages * 5 tokens)
      expect(user?.tokensSpent).toBe(10);
    });

    it('should handle processing failure', async () => {
      // Create a job with invalid user to trigger failure
      const job = {
        id: 'test-job-chat-failure',
        data: {
          userId: 'non-existent-user',
          message: 'Test message',
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
        updateProgress: jest.fn(),
      } as unknown as Job;

      const jobProcessor = processor.getProcessor();
      const result = await jobProcessor(job);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Verify tokens were NOT deducted for failed job
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { tokensBalance: true, tokensSpent: true },
      });

      expect(user?.tokensBalance).toBe(1000); // Unchanged
      expect(user?.tokensSpent).toBe(0);
    });

    it('should handle insufficient tokens', async () => {
      // Set user balance to insufficient amount
      await db.user.update({
        where: { id: userId },
        data: {
          tokensBalance: 2,
        },
      });

      const job = {
        id: 'test-job-chat-insufficient',
        data: {
          userId,
          message: 'Test message',
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
        updateProgress: jest.fn(),
      } as unknown as Job;

      const jobProcessor = processor.getProcessor();
      const result = await jobProcessor(job);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Token deduction failed');

      // Verify balance is unchanged
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { tokensBalance: true },
      });

      expect(user?.tokensBalance).toBe(2); // Unchanged
    });

    it('should store chat options', async () => {
      const job = {
        id: 'test-job-chat-options',
        data: {
          userId,
          message: 'Tell me a story',
          model: 'gpt-4-turbo',
          options: {
            temperature: 0.7,
            maxTokens: 500,
          },
          timestamp: Date.now(),
        },
        attemptsMade: 0,
        opts: { attempts: 3 },
        updateProgress: jest.fn(),
      } as unknown as Job;

      const jobProcessor = processor.getProcessor();
      const result = await jobProcessor(job);

      expect(result.success).toBe(true);

      // Verify messages were stored with model
      const messages = await db.chatMessage.findMany({
        where: { userId },
      });

      expect(messages[0].model).toBe('gpt-4-turbo');
      expect(messages[1].model).toBe('gpt-4-turbo');
    });
  });

  describe('Token Management', () => {
    it('should correctly track token costs for multiple messages', async () => {
      const jobProcessor = processor.getProcessor();

      // Send 3 messages
      for (let i = 0; i < 3; i++) {
        const job = {
          id: `test-job-chat-${i}`,
          data: {
            userId,
            message: `Message ${i}`,
            timestamp: Date.now(),
          },
          attemptsMade: 0,
          opts: { attempts: 3 },
          updateProgress: jest.fn(),
        } as unknown as Job;

        await jobProcessor(job);
      }

      // Verify tokens were deducted correctly
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { tokensBalance: true, tokensSpent: true },
      });

      expect(user?.tokensBalance).toBe(985); // 1000 - 15 (3 messages * 5 tokens)
      expect(user?.tokensSpent).toBe(15);

      // Verify ledger entries
      const ledgerEntries = await db.tokenOperation.findMany({
        where: { userId },
      });

      expect(ledgerEntries).toHaveLength(3);
      ledgerEntries.forEach((entry) => {
        expect(entry.operationType).toBe('chatgpt_message');
        expect(entry.tokensAmount).toBe(-5);
      });
    });
  });
});
