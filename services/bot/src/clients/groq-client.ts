import Groq from 'groq-sdk';
import { Monitoring } from '@monorepo/monitoring';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqClientConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  monitoring?: Monitoring;
}

export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class GroqClient {
  private client: Groq;
  private model: string;
  private maxTokens: number;
  private temperature: number;
  private monitoring?: Monitoring;

  constructor(config: GroqClientConfig) {
    this.client = new Groq({
      apiKey: config.apiKey,
    });
    this.model = config.model || 'llama-3.1-70b-versatile';
    this.maxTokens = config.maxTokens || 2048;
    this.temperature = config.temperature || 0.7;
    this.monitoring = config.monitoring;
  }

  /**
   * Send chat completion request
   */
  async chat(messages: ChatMessage[]): Promise<ChatResponse> {
    const startTime = Date.now();

    try {
      const completion = await this.client.chat.completions.create({
        messages,
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      });

      const duration = Date.now() - startTime;

      const content = completion.choices[0]?.message?.content || '';
      const usage = completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : undefined;

      if (this.monitoring) {
        this.monitoring.metrics.trackGenerationSuccess('groq');
        this.monitoring.logger.info(
          {
            model: this.model,
            duration,
            usage,
          },
          'Groq chat completion successful'
        );
      }

      return {
        content,
        model: this.model,
        usage,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      if (this.monitoring) {
        const errorType = this.getErrorType(error);
        this.monitoring.metrics.trackGenerationFailure('groq', errorType);
        this.monitoring.logger.error(
          {
            error,
            model: this.model,
            duration,
          },
          'Groq chat completion failed'
        );
      }

      throw this.handleError(error);
    }
  }

  /**
   * Send streaming chat completion request
   */
  async *chatStream(messages: ChatMessage[]): AsyncGenerator<string, void, unknown> {
    const startTime = Date.now();

    try {
      const stream = await this.client.chat.completions.create({
        messages,
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        stream: true,
      });

      let totalContent = '';

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          totalContent += content;
          yield content;
        }
      }

      const duration = Date.now() - startTime;

      if (this.monitoring) {
        this.monitoring.metrics.trackGenerationSuccess('groq');
        this.monitoring.logger.info(
          {
            model: this.model,
            duration,
            contentLength: totalContent.length,
          },
          'Groq streaming chat completion successful'
        );
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      if (this.monitoring) {
        const errorType = this.getErrorType(error);
        this.monitoring.metrics.trackGenerationFailure('groq', errorType);
        this.monitoring.logger.error(
          {
            error,
            model: this.model,
            duration,
          },
          'Groq streaming chat completion failed'
        );
      }

      throw this.handleError(error);
    }
  }

  /**
   * Get error type for monitoring
   */
  private getErrorType(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('rate limit') || message.includes('429')) {
        return 'rate_limit';
      }
      if (message.includes('timeout')) {
        return 'timeout';
      }
      if (message.includes('authentication') || message.includes('401')) {
        return 'auth_error';
      }
      if (message.includes('network')) {
        return 'network_error';
      }
    }
    return 'unknown_error';
  }

  /**
   * Handle and normalize errors
   */
  private handleError(error: unknown): Error {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('rate limit') || message.includes('429')) {
        return new Error('Groq rate limit exceeded. Please try again later.');
      }

      if (message.includes('authentication') || message.includes('401')) {
        return new Error('Groq authentication failed. Please check API key.');
      }

      if (message.includes('timeout')) {
        return new Error('Groq request timed out. Please try again.');
      }

      return error;
    }

    return new Error('Unknown Groq error occurred');
  }
}
