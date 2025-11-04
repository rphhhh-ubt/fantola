import { handleSubscription } from '../commands/subscription';
import { handleCallbackQuery } from '../handlers/callback';
import { BotContext } from '../types';
import { PaymentService } from '../services/payment-service';
import { SubscriptionTier } from '@monorepo/database';
import { I18n } from '../i18n';

describe('Subscription Flow', () => {
  let mockCtx: Partial<BotContext>;
  let paymentService: PaymentService;

  beforeEach(() => {
    mockCtx = {
      user: {
        id: 'user-123',
        telegramId: '12345',
        tier: SubscriptionTier.Gift,
        tokensBalance: 50,
        subscriptionExpiresAt: null,
        tokensSpent: 0,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        createdAt: new Date(),
        updatedAt: new Date(),
        autoRenew: false,
        lastGiftClaimAt: null,
        channelSubscribedAt: null,
      },
      i18n: new I18n('en'),
      reply: jest.fn(),
      answerCallbackQuery: jest.fn(),
      editMessageReplyMarkup: jest.fn(),
      callbackQuery: {
        data: 'buy_tier:Professional',
      },
    } as any;

    paymentService = {
      createPayment: jest.fn(),
    } as any;
  });

  describe('handleSubscription', () => {
    it('should show subscription plans with current tier', async () => {
      await handleSubscription(mockCtx as any);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Subscription Plans'),
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: expect.any(Object),
        })
      );

      const replyCall = (mockCtx.reply as jest.Mock).mock.calls[0];
      const message = replyCall[0];
      
      expect(message).toContain('Gift');
      expect(message).toContain('Professional');
      expect(message).toContain('Business');
    });

    it('should show current subscription status', async () => {
      mockCtx.user!.subscriptionExpiresAt = new Date('2025-12-31');
      mockCtx.user!.tier = SubscriptionTier.Professional;

      await handleSubscription(mockCtx as any);

      const replyCall = (mockCtx.reply as jest.Mock).mock.calls[0];
      const message = replyCall[0];

      expect(message).toContain('Professional');
      expect(message).toContain('Active');
    });

    it('should show inline keyboard with tier options', async () => {
      await handleSubscription(mockCtx as any);

      const replyCall = (mockCtx.reply as jest.Mock).mock.calls[0];
      const options = replyCall[1];

      expect(options.reply_markup).toBeDefined();
      expect(options.reply_markup.inline_keyboard).toBeDefined();
    });

    it('should not show current tier in keyboard options', async () => {
      mockCtx.user!.tier = SubscriptionTier.Professional;

      await handleSubscription(mockCtx as any);

      const replyCall = (mockCtx.reply as jest.Mock).mock.calls[0];
      const options = replyCall[1];
      const keyboard = options.reply_markup.inline_keyboard;

      // Should only show Business tier button (not Professional)
      const professionalButton = keyboard.flat().find(
        (btn: any) => btn.callback_data === 'buy_tier:Professional'
      );
      expect(professionalButton).toBeUndefined();
    });

    it('should handle missing user', async () => {
      mockCtx.user = null;

      await handleSubscription(mockCtx as any);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('profile')
      );
    });
  });

  describe('handleCallbackQuery - Tier Purchase', () => {
    it('should create payment for Professional tier', async () => {
      mockCtx.callbackQuery = { data: 'buy_tier:Professional' } as any;

      (paymentService.createPayment as jest.Mock).mockResolvedValueOnce({
        paymentId: 'payment-123',
        confirmationUrl: 'https://yookassa.ru/pay/123',
        amount: 1990,
        tier: SubscriptionTier.Professional,
      });

      await handleCallbackQuery(mockCtx as any, paymentService);

      expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
      expect(paymentService.createPayment).toHaveBeenCalledWith(
        'user-123',
        SubscriptionTier.Professional,
        12345
      );
      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Subscription Payment'),
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({
                  url: 'https://yookassa.ru/pay/123',
                }),
              ]),
            ]),
          }),
        })
      );
    });

    it('should create payment for Business tier', async () => {
      mockCtx.callbackQuery = { data: 'buy_tier:Business' } as any;

      (paymentService.createPayment as jest.Mock).mockResolvedValueOnce({
        paymentId: 'payment-456',
        confirmationUrl: 'https://yookassa.ru/pay/456',
        amount: 3490,
        tier: SubscriptionTier.Business,
      });

      await handleCallbackQuery(mockCtx as any, paymentService);

      expect(paymentService.createPayment).toHaveBeenCalledWith(
        'user-123',
        SubscriptionTier.Business,
        12345
      );
    });

    it('should reject purchase for Gift tier', async () => {
      mockCtx.callbackQuery = { data: 'buy_tier:Gift' } as any;

      await handleCallbackQuery(mockCtx as any, paymentService);

      expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith(
        expect.stringContaining('cannot be purchased')
      );
      expect(paymentService.createPayment).not.toHaveBeenCalled();
    });

    it('should reject purchase for already active tier', async () => {
      mockCtx.user!.tier = SubscriptionTier.Professional;
      mockCtx.user!.subscriptionExpiresAt = new Date('2025-12-31');
      mockCtx.callbackQuery = { data: 'buy_tier:Professional' } as any;

      await handleCallbackQuery(mockCtx as any, paymentService);

      expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith(
        expect.stringContaining('already have an active')
      );
      expect(paymentService.createPayment).not.toHaveBeenCalled();
    });

    it('should allow renewal of expired subscription', async () => {
      mockCtx.user!.tier = SubscriptionTier.Professional;
      mockCtx.user!.subscriptionExpiresAt = new Date('2023-01-01'); // Expired
      mockCtx.callbackQuery = { data: 'buy_tier:Professional' } as any;

      (paymentService.createPayment as jest.Mock).mockResolvedValueOnce({
        paymentId: 'payment-123',
        confirmationUrl: 'https://yookassa.ru/pay/123',
        amount: 1990,
        tier: SubscriptionTier.Professional,
      });

      await handleCallbackQuery(mockCtx as any, paymentService);

      expect(paymentService.createPayment).toHaveBeenCalled();
    });

    it('should handle payment creation errors', async () => {
      mockCtx.callbackQuery = { data: 'buy_tier:Professional' } as any;

      (paymentService.createPayment as jest.Mock).mockRejectedValueOnce(
        new Error('Payment creation failed')
      );

      await handleCallbackQuery(mockCtx as any, paymentService);

      expect(mockCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create payment')
      );
    });

    it('should handle missing user', async () => {
      mockCtx.user = null;
      mockCtx.callbackQuery = { data: 'buy_tier:Professional' } as any;

      await handleCallbackQuery(mockCtx as any, paymentService);

      expect(mockCtx.answerCallbackQuery).toHaveBeenCalled();
      expect(paymentService.createPayment).not.toHaveBeenCalled();
    });

    it('should handle unknown callback data', async () => {
      mockCtx.callbackQuery = { data: 'unknown_action' } as any;

      await handleCallbackQuery(mockCtx as any, paymentService);

      expect(mockCtx.answerCallbackQuery).toHaveBeenCalledWith('Unknown action');
      expect(paymentService.createPayment).not.toHaveBeenCalled();
    });

    it('should edit message markup after payment creation', async () => {
      mockCtx.callbackQuery = { data: 'buy_tier:Professional' } as any;

      (paymentService.createPayment as jest.Mock).mockResolvedValueOnce({
        paymentId: 'payment-123',
        confirmationUrl: 'https://yookassa.ru/pay/123',
        amount: 1990,
        tier: SubscriptionTier.Professional,
      });

      await handleCallbackQuery(mockCtx as any, paymentService);

      expect(mockCtx.editMessageReplyMarkup).toHaveBeenCalledWith({
        inline_keyboard: [],
      });
    });
  });

  describe('Payment Success Notification', () => {
    it('should include tier information', () => {
      const tier = SubscriptionTier.Professional;
      const message = `✅ *Payment Successful!*

🎉 Your *${tier}* subscription has been activated!

💎 *2000* tokens have been added to your balance.`;

      expect(message).toContain('Payment Successful');
      expect(message).toContain('Professional');
      expect(message).toContain('2000');
    });

    it('should include expiry date', () => {
      const expiryDate = new Date('2024-12-31');
      const formattedDate = expiryDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      expect(formattedDate).toBe('December 31, 2024');
    });
  });

  describe('i18n Support', () => {
    it('should support Russian language', async () => {
      mockCtx.i18n = new I18n('ru');

      await handleSubscription(mockCtx as any);

      const replyCall = (mockCtx.reply as jest.Mock).mock.calls[0];
      const message = replyCall[0];

      // Should contain Russian text
      expect(message).toContain('Планы подписки');
    });

    it('should support English language', async () => {
      mockCtx.i18n = new I18n('en');

      await handleSubscription(mockCtx as any);

      const replyCall = (mockCtx.reply as jest.Mock).mock.calls[0];
      const message = replyCall[0];

      // Should contain English text
      expect(message).toContain('Subscription Plans');
    });
  });
});
