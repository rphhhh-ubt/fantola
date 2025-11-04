import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { Monitoring } from '@monorepo/monitoring';

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }>;
}

export interface GeminiClientConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  monitoring?: Monitoring;
}

export interface GeminiChatResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ImageInput {
  data: Buffer | string;
  mimeType: string;
}

export class GeminiClient {
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;
  private modelName: string;
  private maxTokens: number;
  private temperature: number;
  private monitoring?: Monitoring;

  constructor(config: GeminiClientConfig) {
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.modelName = config.model || 'gemini-1.5-flash';
    this.maxTokens = config.maxTokens || 2048;
    this.temperature = config.temperature || 0.7;
    this.monitoring = config.monitoring;

    this.model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        maxOutputTokens: this.maxTokens,
        temperature: this.temperature,
      },
    });
  }

  /**
   * Send chat completion request with text only
   */
  async chat(messages: Array<{ role: string; content: string }>): Promise<GeminiChatResponse> {
    const startTime = Date.now();

    try {
      // Convert messages to Gemini format
      const geminiMessages = this.convertMessages(messages);

      // Start chat session with history
      const chat = this.model.startChat({
        history: geminiMessages.slice(0, -1),
      });

      // Send last message
      const lastMessage = geminiMessages[geminiMessages.length - 1];
      const lastMessageText = lastMessage.parts
        .filter((part): part is { text: string } => 'text' in part)
        .map((part) => part.text)
        .join('\n');

      const result = await chat.sendMessage(lastMessageText);
      const response = await result.response;
      const content = response.text();

      const duration = Date.now() - startTime;

      if (this.monitoring) {
        this.monitoring.metrics.trackGenerationSuccess('gemini');
        this.monitoring.logger.info(
          {
            model: this.modelName,
            duration,
          },
          'Gemini chat completion successful'
        );
      }

      return {
        content,
        model: this.modelName,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      if (this.monitoring) {
        const errorType = this.getErrorType(error);
        this.monitoring.metrics.trackGenerationFailure('gemini', errorType);
        this.monitoring.logger.error(
          {
            error,
            model: this.modelName,
            duration,
          },
          'Gemini chat completion failed'
        );
      }

      throw this.handleError(error);
    }
  }

  /**
   * Send chat completion with vision (images + text)
   */
  async chatWithVision(
    messages: Array<{ role: string; content: string }>,
    images: ImageInput[]
  ): Promise<GeminiChatResponse> {
    const startTime = Date.now();

    try {
      // Combine text from messages
      const textContent = messages
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n');

      // Prepare parts with images and text
      const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

      // Add images
      for (const image of images) {
        const imageData = Buffer.isBuffer(image.data)
          ? image.data.toString('base64')
          : image.data;

        parts.push({
          inlineData: {
            data: imageData,
            mimeType: image.mimeType,
          },
        });
      }

      // Add text
      parts.push({
        text: textContent,
      });

      const result = await this.model.generateContent(parts);
      const response = await result.response;
      const content = response.text();

      const duration = Date.now() - startTime;

      if (this.monitoring) {
        this.monitoring.metrics.trackGenerationSuccess('gemini');
        this.monitoring.logger.info(
          {
            model: this.modelName,
            duration,
            imageCount: images.length,
          },
          'Gemini vision completion successful'
        );
      }

      return {
        content,
        model: this.modelName,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      if (this.monitoring) {
        const errorType = this.getErrorType(error);
        this.monitoring.metrics.trackGenerationFailure('gemini', errorType);
        this.monitoring.logger.error(
          {
            error,
            model: this.modelName,
            duration,
          },
          'Gemini vision completion failed'
        );
      }

      throw this.handleError(error);
    }
  }

  /**
   * Send streaming chat completion
   */
  async *chatStream(
    messages: Array<{ role: string; content: string }>
  ): AsyncGenerator<string, void, unknown> {
    const startTime = Date.now();

    try {
      // Convert messages to Gemini format
      const geminiMessages = this.convertMessages(messages);

      // Start chat session with history
      const chat = this.model.startChat({
        history: geminiMessages.slice(0, -1),
      });

      // Send last message with streaming
      const lastMessage = geminiMessages[geminiMessages.length - 1];
      const lastMessageText = lastMessage.parts
        .filter((part): part is { text: string } => 'text' in part)
        .map((part) => part.text)
        .join('\n');

      const result = await chat.sendMessageStream(lastMessageText);

      let totalContent = '';

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          totalContent += chunkText;
          yield chunkText;
        }
      }

      const duration = Date.now() - startTime;

      if (this.monitoring) {
        this.monitoring.metrics.trackGenerationSuccess('gemini');
        this.monitoring.logger.info(
          {
            model: this.modelName,
            duration,
            contentLength: totalContent.length,
          },
          'Gemini streaming chat completion successful'
        );
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      if (this.monitoring) {
        const errorType = this.getErrorType(error);
        this.monitoring.metrics.trackGenerationFailure('gemini', errorType);
        this.monitoring.logger.error(
          {
            error,
            model: this.modelName,
            duration,
          },
          'Gemini streaming chat completion failed'
        );
      }

      throw this.handleError(error);
    }
  }

  /**
   * Convert standard messages to Gemini format
   */
  private convertMessages(
    messages: Array<{ role: string; content: string }>
  ): GeminiMessage[] {
    return messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));
  }

  /**
   * Get error type for monitoring
   */
  private getErrorType(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('rate limit') || message.includes('429') || message.includes('quota')) {
        return 'rate_limit';
      }
      if (message.includes('timeout')) {
        return 'timeout';
      }
      if (message.includes('authentication') || message.includes('401') || message.includes('api key')) {
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

      if (message.includes('rate limit') || message.includes('429') || message.includes('quota')) {
        return new Error('Gemini rate limit exceeded. Please try again later.');
      }

      if (message.includes('authentication') || message.includes('401') || message.includes('api key')) {
        return new Error('Gemini authentication failed. Please check API key.');
      }

      if (message.includes('timeout')) {
        return new Error('Gemini request timed out. Please try again.');
      }

      return error;
    }

    return new Error('Unknown Gemini error occurred');
  }
}
