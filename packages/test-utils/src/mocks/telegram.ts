export interface MockTelegramMessage {
  message_id: number;
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
  };
  date: number;
  text?: string;
}

export interface MockTelegramUpdate {
  update_id: number;
  message?: MockTelegramMessage;
}

export class MockTelegramBot {
  private sentMessages: Array<{ chatId: number; text: string; options?: any }> = [];
  private mockResponses: Map<string, any> = new Map();

  sendMessage(chatId: number, text: string, options?: any): Promise<MockTelegramMessage> {
    this.sentMessages.push({ chatId, text, options });
    return Promise.resolve({
      message_id: Date.now(),
      chat: { id: chatId, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      text,
    });
  }

  getSentMessages() {
    return this.sentMessages;
  }

  clearSentMessages() {
    this.sentMessages = [];
  }

  setMockResponse(method: string, response: any) {
    this.mockResponses.set(method, response);
  }

  getMockResponse(method: string) {
    return this.mockResponses.get(method);
  }

  clearMockResponses() {
    this.mockResponses.clear();
  }
}

export function createMockTelegramUpdate(
  overrides?: Partial<MockTelegramUpdate>
): MockTelegramUpdate {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: Math.floor(Math.random() * 1000000),
      from: {
        id: 12345,
        is_bot: false,
        first_name: 'Test',
        username: 'testuser',
      },
      chat: {
        id: 12345,
        type: 'private',
      },
      date: Math.floor(Date.now() / 1000),
      text: '/start',
    },
    ...overrides,
  };
}

export function createMockTelegramMessage(
  overrides?: Partial<MockTelegramMessage>
): MockTelegramMessage {
  return {
    message_id: Math.floor(Math.random() * 1000000),
    from: {
      id: 12345,
      is_bot: false,
      first_name: 'Test',
      username: 'testuser',
    },
    chat: {
      id: 12345,
      type: 'private',
    },
    date: Math.floor(Date.now() / 1000),
    text: 'Test message',
    ...overrides,
  };
}
