import type {
  IChatClient,
  ChatCompletionOptions,
  ChatCompletionResponse,
  ChatCompletionChunk,
} from '../types';
import { ChatProvider as Provider } from '../types';

/**
 * Groq API client
 * Provides access to fast LLM inference
 */
export class GroqClient implements IChatClient {
  public readonly provider = Provider.GROQ;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: { apiKey: string; baseUrl?: string }) {
    if (!config.apiKey) {
      throw new Error('Groq API key is required');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.groq.com/openai/v1';
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
        user: options.user,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
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
        provider: 'groq',
        model: data.model,
        systemFingerprint: data.system_fingerprint,
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
        user: options.user,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
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
    // Groq pricing (as of 2024)
    // These are example prices - should be fetched from Groq API or config
    const pricing: Record<string, { input: number; output: number }> = {
      'llama-3.1-405b-reasoning': { input: 0.00059, output: 0.00079 },
      'llama-3.1-70b-versatile': { input: 0.00059, output: 0.00079 },
      'llama-3.1-8b-instant': { input: 0.00005, output: 0.00008 },
      'llama3-groq-70b-8192-tool-use-preview': { input: 0.00089, output: 0.00089 },
      'llama3-groq-8b-8192-tool-use-preview': { input: 0.00019, output: 0.00019 },
      'mixtral-8x7b-32768': { input: 0.00024, output: 0.00024 },
      'gemma2-9b-it': { input: 0.0002, output: 0.0002 },
    };

    const modelPricing = pricing[model] || { input: 0.0001, output: 0.0001 };
    const inputCost = (promptTokens / 1000) * modelPricing.input;
    const outputCost = (completionTokens / 1000) * modelPricing.output;

    return inputCost + outputCost;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private calculateCostFromResponse(data: any): number | undefined {
    if (!data.usage) return undefined;

    const model = data.model;
    return this.estimateCost(model, data.usage.prompt_tokens, data.usage.completion_tokens);
  }
}
