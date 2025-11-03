export interface MockAIResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: 'assistant' | 'user' | 'system';
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class MockOpenAIClient {
  private mockResponses: MockAIResponse[] = [];
  private calls: Array<{ messages: any[]; options?: any }> = [];

  chat = {
    completions: {
      create: async (params: any): Promise<MockAIResponse> => {
        this.calls.push({ messages: params.messages, options: params });

        if (this.mockResponses.length > 0) {
          return this.mockResponses.shift()!;
        }

        return {
          id: `chatcmpl-${Date.now()}`,
          model: params.model || 'gpt-3.5-turbo',
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Mocked AI response',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
          },
        };
      },
    },
  };

  setMockResponse(response: MockAIResponse) {
    this.mockResponses.push(response);
  }

  setMockResponses(responses: MockAIResponse[]) {
    this.mockResponses = [...responses];
  }

  getCalls() {
    return this.calls;
  }

  clearCalls() {
    this.calls = [];
  }

  clearMockResponses() {
    this.mockResponses = [];
  }
}

export class MockAnthropicClient {
  private mockResponses: any[] = [];
  private calls: Array<{ messages: any[]; options?: any }> = [];

  messages = {
    create: async (params: any): Promise<any> => {
      this.calls.push({ messages: params.messages, options: params });

      if (this.mockResponses.length > 0) {
        return this.mockResponses.shift()!;
      }

      return {
        id: `msg_${Date.now()}`,
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Mocked Anthropic response',
          },
        ],
        model: params.model || 'claude-3-opus-20240229',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
      };
    },
  };

  setMockResponse(response: any) {
    this.mockResponses.push(response);
  }

  setMockResponses(responses: any[]) {
    this.mockResponses = [...responses];
  }

  getCalls() {
    return this.calls;
  }

  clearCalls() {
    this.calls = [];
  }

  clearMockResponses() {
    this.mockResponses = [];
  }
}

export function createMockAIResponse(overrides?: Partial<MockAIResponse>): MockAIResponse {
  return {
    id: `chatcmpl-${Date.now()}`,
    model: 'gpt-3.5-turbo',
    choices: [
      {
        message: {
          role: 'assistant',
          content: 'Mocked AI response',
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    },
    ...overrides,
  };
}
