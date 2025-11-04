import type {
  IChatClient,
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatCompletionChunk,
} from '../types';
import { ChatProvider as Provider } from '../types';

/**
 * OpenRouter API client
 * Provides access to multiple LLM models through a unified API
 */
export class OpenRouterClient implements IChatClient {
  public readonly provider = Provider.OPENROUTER;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly siteName?: string;
  private readonly siteUrl?: string;

  constructor(config: {
    apiKey: string;
    baseUrl?: string;
    siteName?: string;
    siteUrl?: string;
  }) {
    if (!config.apiKey) {
      throw new Error('OpenRouter API key is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://openrouter.ai/api/v1';
    this.siteName = config.siteName;
    this.siteUrl = config.siteUrl;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async createCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data: any = await response.json();

    return {
      id: data.id,
      provider: this.provider,
      model: data.model,
      content: data.choices[0]?.message?.content || '',
      finishReason: data.choices[0]?.finish_reason || 'unknown',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      cost: this.calculateCostFromResponse(data),
      metadata: {
        provider: 'openrouter',
        model: data.model,
      },
    };
  }

  async *createStreamingCompletion(
    options: ChatCompletionOptions,
  ): AsyncGenerator<ChatCompletionChunk, void, unknown> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        top_p: options.topP,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices[0]?.delta?.content || '';
            const finishReason = json.choices[0]?.finish_reason;

            yield {
              delta,
              finishReason,
              usage: json.usage
                ? {
                    promptTokens: json.usage.prompt_tokens,
                    completionTokens: json.usage.completion_tokens,
                    totalTokens: json.usage.total_tokens,
                  }
                : undefined,
            };
          } catch (parseError) {
            // Skip invalid JSON lines
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  estimateCost(model: string, promptTokens: number, completionTokens: number): number {
    // OpenRouter pricing varies by model
    // These are example prices - should be fetched from OpenRouter API or config
    const pricing: Record<string, { input: number; output: number }> = {
      'openai/gpt-4-turbo': { input: 0.01, output: 0.03 },
      'openai/gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
      'anthropic/claude-3-opus': { input: 0.015, output: 0.075 },
      'anthropic/claude-3-sonnet': { input: 0.003, output: 0.015 },
      'meta-llama/llama-3.1-70b-instruct': { input: 0.0003, output: 0.0004 },
    };

    const modelPricing = pricing[model] || { input: 0.001, output: 0.002 };
    const inputCost = (promptTokens / 1000) * modelPricing.input;
    const outputCost = (completionTokens / 1000) * modelPricing.output;

    return inputCost + outputCost;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    if (this.siteName) {
      headers['HTTP-Referer'] = this.siteUrl || 'https://localhost';
      headers['X-Title'] = this.siteName;
    }

    return headers;
  }

  private calculateCostFromResponse(data: any): number | undefined {
    if (!data.usage) return undefined;

    const model = data.model;
    return this.estimateCost(model, data.usage.prompt_tokens, data.usage.completion_tokens);
  }
}
