import { handleHelp } from '../commands/help';
import { BotContext } from '../types';
import { MockTelegramBot, createMockTelegramUpdate } from '@monorepo/test-utils';
import { I18n } from '../i18n';

describe('Command Handlers', () => {
  let mockBot: MockTelegramBot;

  beforeEach(() => {
    mockBot = new MockTelegramBot();
  });

  afterEach(() => {
    mockBot.clearSentMessages();
  });

  describe('handleHelp', () => {
    it('should send help message', async () => {
      const update = createMockTelegramUpdate({
        message: {
          message_id: 1,
          chat: { id: 12345, type: 'private' },
          date: Date.now(),
          text: '/help',
          from: {
            id: 12345,
            is_bot: false,
            first_name: 'Test',
            username: 'testuser',
          },
        },
      });

      // Mock context
      const ctx = {
        update,
        message: update.message,
        from: update.message?.from,
        chat: update.message?.chat,
        i18n: new I18n('en'),
        reply: jest.fn().mockResolvedValue({}),
      } as unknown as BotContext;

      await handleHelp(ctx as any);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Available Commands'),
        { parse_mode: 'Markdown' }
      );
    });
  });
});
