import { GroqClient, ChatMessage as GroqMessage } from '../clients/groq-client';
import { GeminiClient, ImageInput } from '../clients/gemini-client';
import { RateLimitTracker } from './rate-limit-tracker';
import { Monitoring } from '@monorepo/monitoring';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  provider: 'groq' | 'gemini';
  model: string;
}

export interface AIServiceConfig {
  groqClient: GroqClient;
  geminiClient: GeminiClient;
  rateLimitTracker: RateLimitTracker;
  monitoring?: Monitoring;
}

export class AIService {
  private groqClient: GroqClient;
  private geminiClient: GeminiClient;
  private rateLimitTracker: RateLimitTracker;
  private monitoring?: Monitoring;

  constructor(config: AIServiceConfig) {
    this.groqClient = config.groqClient;
    this.geminiClient = config.geminiClient;
    this.rateLimitTracker = config.rateLimitTracker;
    this.monitoring = config.monitoring;
  }

  /**
   * Send chat request (text-only)
   * Uses Groq for text-only messages
   */
  async chat(messages: AIMessage[]): Promise<AIResponse> {
    // Check Groq rate limit
    const groqStats = await this.rateLimitTracker.checkGroqLimit();

    if (groqStats.isAtLimit) {
      const errorMessage = this.rateLimitTracker.formatRateLimitError('groq', groqStats);
      throw new Error(errorMessage);
    }

    try {
      // Use Groq for text chat
      const groqMessages: GroqMessage[] = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await this.groqClient.chat(groqMessages);

      // Increment usage counter
      await this.rateLimitTracker.incrementGroq();

      return {
        content: response.content,
        provider: 'groq',
        model: response.model,
      };
    } catch (error) {
      if (this.monitoring) {
        this.monitoring.logger.error(
          {
            error,
            provider: 'groq',
          },
          'Groq chat request failed'
        );
      }

      throw error;
    }
  }

  /**
   * Send chat request with vision (images + text)
   * Uses Gemini Flash for vision tasks
   */
  async chatWithVision(messages: AIMessage[], images: ImageInput[]): Promise<AIResponse> {
    // Check Gemini rate limit
    const geminiStats = await this.rateLimitTracker.checkGeminiLimit();

    if (geminiStats.isAtLimit) {
      const errorMessage = this.rateLimitTracker.formatRateLimitError('gemini', geminiStats);
      throw new Error(errorMessage);
    }

    try {
      // Use Gemini for vision
      const geminiMessages = messages.map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : msg.role,
        content: msg.content,
      }));

      const response = await this.geminiClient.chatWithVision(geminiMessages, images);

      // Increment usage counter
      await this.rateLimitTracker.incrementGemini();

      return {
        content: response.content,
        provider: 'gemini',
        model: response.model,
      };
    } catch (error) {
      if (this.monitoring) {
        this.monitoring.logger.error(
          {
            error,
            provider: 'gemini',
          },
          'Gemini vision request failed'
        );
      }

      throw error;
    }
  }

  /**
   * Stream chat response (text-only)
   */
  async *chatStream(messages: AIMessage[]): AsyncGenerator<string, void, unknown> {
    // Check Groq rate limit
    const groqStats = await this.rateLimitTracker.checkGroqLimit();

    if (groqStats.isAtLimit) {
      const errorMessage = this.rateLimitTracker.formatRateLimitError('groq', groqStats);
      throw new Error(errorMessage);
    }

    try {
      // Use Groq for text chat streaming
      const groqMessages: GroqMessage[] = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      for await (const chunk of this.groqClient.chatStream(groqMessages)) {
        yield chunk;
      }

      // Increment usage counter
      await this.rateLimitTracker.incrementGroq();
    } catch (error) {
      if (this.monitoring) {
        this.monitoring.logger.error(
          {
            error,
            provider: 'groq',
          },
          'Groq streaming request failed'
        );
      }

      throw error;
    }
  }

  /**
   * Get usage statistics for all providers
   */
  async getUsageStats() {
    const [groqStats, geminiStats] = await Promise.all([
      this.rateLimitTracker.getStats('groq'),
      this.rateLimitTracker.getStats('gemini'),
    ]);

    return {
      groq: groqStats,
      gemini: geminiStats,
    };
  }
}
