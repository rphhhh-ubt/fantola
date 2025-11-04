import { Context, SessionFlavor } from 'grammy';
import { User } from '@monorepo/database';
import { Language, I18n } from './i18n';
import { ChannelVerificationService } from './services/channel-verification-service';
import { PaymentService } from './services/payment-service';

/**
 * Session data stored in Redis
 */
export interface SessionData {
  userId?: string;
  telegramId?: number;
  username?: string;
  language?: Language;
  state?: string;
  conversationContext?: {
    lastCommand?: string;
    lastPrompt?: string;
    messageCount?: number;
  };
}

/**
 * Custom bot context with session and user data
 */
export interface BotContext extends Context, SessionFlavor<SessionData> {
  user?: User | null;
  i18n: I18n;
  channelVerification?: ChannelVerificationService;
  paymentService?: PaymentService;
}

/**
 * Bot mode: polling (development) or webhook (production)
 */
export type BotMode = 'polling' | 'webhook';

/**
 * Configuration for bot initialization
 */
export interface BotInitConfig {
  mode: BotMode;
  webhookDomain?: string;
  webhookPath?: string;
  webhookSecret?: string;
}
