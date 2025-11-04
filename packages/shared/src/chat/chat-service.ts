import { v4 as uuidv4 } from 'uuid';
import type { PrismaClient } from '@monorepo/database';
import { OperationType } from '@monorepo/database';
import { TokenService } from '../tokens/token-service';
import { ProviderSelector } from './providers/provider-selector';
import { ModerationService } from './providers/moderation-service';
import type {
  IChatClient,
  ChatCompletionMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatServiceOptions,
  ProviderSelectionOptions,
  ChatCompletionChunk,
  ChatProvider,
} from './types';
import { TOKEN_COSTS } from '../tokens/types';

/**
 * Main chat service that integrates token accounting, provider selection, and moderation
 */
export class ChatService {
  private readonly db: PrismaClient;
  private readonly tokenService: TokenService;
  private readonly providerSelector: ProviderSelector;
  private readonly moderationService: ModerationService;
  private readonly options: {
    tokenServiceOptions: ChatServiceOptions['tokenServiceOptions'];
    moderationEnabled: boolean;
    maxConversationHistory: number;
    defaultModel: string;
    defaultProvider?: ChatProvider;
  };

  constructor(
    db: PrismaClient,
    clients: IChatClient[],
    options: ChatServiceOptions = {},
  ) {
    this.db = db;
    this.tokenService = new TokenService(db, options.tokenServiceOptions);
    this.providerSelector = new ProviderSelector(clients);
    this.moderationService = new ModerationService();

    this.options = {
      tokenServiceOptions: options.tokenServiceOptions || {},
      moderationEnabled: options.moderationEnabled ?? true,
      maxConversationHistory: options.maxConversationHistory ?? 50,
      defaultModel: options.defaultModel || 'llama-3.1-8b-instant',
      defaultProvider: options.defaultProvider || undefined,
    };
  }

  /**
   * Create a chat completion with token deduction and message logging
   */
  async createCompletion(
    userId: string,
    messages: ChatCompletionMessage[],
    options: Partial<ChatCompletionOptions> & ProviderSelectionOptions = {},
  ): Promise<ChatCompletionResult> {
    // Check if user can afford the operation
    const canAfford = await this.tokenService.canAfford(userId, OperationType.chatgpt_message);
    if (!canAfford) {
      throw new Error('Insufficient tokens for chat completion');
    }

    // Moderate user message if enabled
    if (this.options.moderationEnabled && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        const moderation = await this.moderationService.moderateContent(lastMessage.content);
        if (moderation.flagged) {
          throw new Error('Message flagged by moderation system');
        }
      }
    }

    // Select provider
    const client = await this.providerSelector.selectProvider(options);

    // Create completion
    const completionOptions: ChatCompletionOptions = {
      model: options.model || this.options.defaultModel,
      messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      topP: options.topP,
      stream: false,
      user: userId,
    };

    const response = await client.createCompletion(completionOptions);

    // Deduct tokens
    const tokenResult = await this.tokenService.chargeForOperation(
      userId,
      OperationType.chatgpt_message,
      {
        model: response.model,
        provider: response.provider,
        tokensUsed: response.usage?.totalTokens,
        cost: response.cost,
      },
    );

    if (!tokenResult.success) {
      throw new Error('Failed to deduct tokens');
    }

    // Generate conversation ID if not provided
    const conversationId = options.conversationId || uuidv4();

    // Log messages to database
    const userMessage = await this.db.chatMessage.create({
      data: {
        id: uuidv4(),
        userId,
        role: 'user',
        content: messages[messages.length - 1].content,
        model: response.model,
        conversationId,
        tokensUsed: response.usage?.promptTokens,
        metadata: {
          provider: response.provider,
        },
      },
    });

    const assistantMessage = await this.db.chatMessage.create({
      data: {
        id: uuidv4(),
        userId,
        role: 'assistant',
        content: response.content,
        model: response.model,
        conversationId,
        tokensUsed: response.usage?.completionTokens,
        metadata: {
          provider: response.provider,
          cost: response.cost,
        },
      },
    });

    return {
      response,
      tokensDeducted: TOKEN_COSTS[OperationType.chatgpt_message],
      newBalance: tokenResult.newBalance,
      conversationId,
      messageIds: {
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
      },
    };
  }

  /**
   * Create a streaming chat completion
   */
  async *createStreamingCompletion(
    userId: string,
    messages: ChatCompletionMessage[],
    options: Partial<ChatCompletionOptions> & ProviderSelectionOptions = {},
  ): AsyncGenerator<ChatCompletionChunk, ChatCompletionResult, unknown> {
    // Check if user can afford the operation
    const canAfford = await this.tokenService.canAfford(userId, OperationType.chatgpt_message);
    if (!canAfford) {
      throw new Error('Insufficient tokens for chat completion');
    }

    // Moderate user message if enabled
    if (this.options.moderationEnabled && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        const moderation = await this.moderationService.moderateContent(lastMessage.content);
        if (moderation.flagged) {
          throw new Error('Message flagged by moderation system');
        }
      }
    }

    // Select provider
    const client = await this.providerSelector.selectProvider(options);

    // Create streaming completion
    const completionOptions: ChatCompletionOptions = {
      model: options.model || this.options.defaultModel,
      messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      topP: options.topP,
      stream: true,
      user: userId,
    };

    let fullContent = '';
    let totalUsage: ChatCompletionChunk['usage'] | undefined;

    for await (const chunk of client.createStreamingCompletion(completionOptions)) {
      fullContent += chunk.delta;
      if (chunk.usage) {
        totalUsage = chunk.usage;
      }
      yield chunk;
    }

    // Deduct tokens after streaming completes
    const tokenResult = await this.tokenService.chargeForOperation(
      userId,
      OperationType.chatgpt_message,
      {
        model: completionOptions.model,
        provider: client.provider,
        tokensUsed: totalUsage?.totalTokens,
      },
    );

    if (!tokenResult.success) {
      throw new Error('Failed to deduct tokens');
    }

    // Generate conversation ID if not provided
    const conversationId = options.conversationId || uuidv4();

    // Log messages to database
    const userMessage = await this.db.chatMessage.create({
      data: {
        id: uuidv4(),
        userId,
        role: 'user',
        content: messages[messages.length - 1].content,
        model: completionOptions.model,
        conversationId,
        tokensUsed: totalUsage?.promptTokens,
        metadata: {
          provider: client.provider,
        },
      },
    });

    const assistantMessage = await this.db.chatMessage.create({
      data: {
        id: uuidv4(),
        userId,
        role: 'assistant',
        content: fullContent,
        model: completionOptions.model,
        conversationId,
        tokensUsed: totalUsage?.completionTokens,
        metadata: {
          provider: client.provider,
        },
      },
    });

    const result: ChatCompletionResult = {
      response: {
        id: uuidv4(),
        provider: client.provider,
        model: completionOptions.model,
        content: fullContent,
        finishReason: 'stop',
        usage: totalUsage,
      },
      tokensDeducted: TOKEN_COSTS[OperationType.chatgpt_message],
      newBalance: tokenResult.newBalance,
      conversationId,
      messageIds: {
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
      },
    };

    return result;
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(
    userId: string,
    conversationId: string,
    limit?: number,
  ): Promise<ChatCompletionMessage[]> {
    const messages = await this.db.chatMessage.findMany({
      where: {
        userId,
        conversationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: limit || this.options.maxConversationHistory,
    });

    return messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    }));
  }

  /**
   * Get provider health status
   */
  async getProviderHealth() {
    return this.providerSelector.getHealthStatus();
  }
}
