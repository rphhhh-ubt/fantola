import { Context, SessionFlavor } from 'grammy';
import { User } from '@monorepo/database';
import { Language, I18n } from './i18n';
import { ChannelVerificationService } from './services/channel-verification-service';
import { PaymentService } from './services/payment-service';
import { ChatHandler } from './handlers/chat-handler';
import { PhotoHandler } from './handlers/photo-handler';
import { ProductCardHandler } from './handlers/product-card-handler';
import { ProductCardMode } from '@monorepo/shared';

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
    conversationId?: string;
    history?: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>;
  };
  productCardContext?: {
    step: 'awaiting_photo' | 'awaiting_mode' | 'awaiting_options' | 'awaiting_input' | 'editing' | 'completed';
    productImage?: {
      data: string;
      mimeType: string;
    };
    mode?: ProductCardMode;
    options?: {
      background?: string;
      pose?: string;
      textHeadline?: string;
      textSubheadline?: string;
      textDescription?: string;
    };
    currentOption?: string;
    generationId?: string;
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
  chatHandler?: ChatHandler;
  photoHandler?: PhotoHandler;
  productCardHandler?: ProductCardHandler;
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
