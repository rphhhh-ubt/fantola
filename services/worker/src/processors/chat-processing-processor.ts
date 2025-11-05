import { Job } from 'bullmq';
import { Monitoring } from '@monorepo/monitoring';
import { db } from '@monorepo/database';
import { BaseProcessor, TokenDeductionConfig, ProcessorContext } from './base-processor';
import { ChatProcessingJobData, QueueName, JobResult, GenerationType } from '@monorepo/shared';

export interface ChatProcessingProcessorConfig extends ProcessorContext {}

/**
 * Processor for chat processing jobs (ChatGPT, etc.)
 * Stores chat messages and handles token deduction
 */
export class ChatProcessingProcessor extends BaseProcessor<ChatProcessingJobData> {
  constructor(config: ChatProcessingProcessorConfig) {
    super(QueueName.CHAT_PROCESSING, config);
  }

  protected getTokenDeductionConfig(): TokenDeductionConfig {
    return {
      enabled: true,
      operationType: 'chatgpt_message',
      skipDeductionOnFailure: true,
    };
  }

  protected getGenerationType(): GenerationType {
    return GenerationType.CHAT;
  }

  async process(job: Job<ChatProcessingJobData>): Promise<JobResult> {
    const { userId, message, conversationId, model, options } = job.data;

    this.monitoring.logger.info(
      {
        jobId: job.id,
        userId,
        conversationId,
        messageLength: message.length,
      },
      'Processing chat job'
    );

    try {
      // Store user message
      const userMessage = await db.chatMessage.create({
        data: {
          userId,
          role: 'user',
          content: message,
          conversationId: conversationId || undefined,
          model,
        },
      });

      // In a real implementation, this would call the chat API
      // For now, we'll simulate a response
      const assistantResponse = await this.generateChatResponse(message, options);

      // Store assistant message
      const assistantMessage = await db.chatMessage.create({
        data: {
          userId,
          role: 'assistant',
          content: assistantResponse,
          conversationId: conversationId || undefined,
          model,
          tokensUsed: 5,
        },
      });

      this.monitoring.logger.info(
        {
          jobId: job.id,
          userId,
          conversationId,
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
        },
        'Chat processing completed successfully'
      );

      this.monitoring.metrics.trackGenerationSuccess('chat');

      return {
        success: true,
        data: {
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
          response: assistantResponse,
        },
      };
    } catch (error) {
      this.monitoring.logger.error(
        {
          jobId: job.id,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Chat processing failed'
      );

      this.monitoring.metrics.trackGenerationFailure(
        'chat',
        error instanceof Error ? error.message : 'unknown'
      );

      throw error;
    }
  }

  private async generateChatResponse(
    message: string,
    _options?: ChatProcessingJobData['options']
  ): Promise<string> {
    // Simulate chat API call
    // In production, this would call OpenAI, Groq, or another chat API
    await new Promise((resolve) => setTimeout(resolve, 500));

    return `This is a simulated response to: "${message.substring(0, 50)}..."`;
  }
}
