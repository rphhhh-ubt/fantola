import { Context, SessionFlavor } from 'grammy';
import { User } from '@monorepo/database';

/**
 * Session data stored in Redis
 */
export interface SessionData {
  userId?: string;
  telegramId?: number;
  username?: string;
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
