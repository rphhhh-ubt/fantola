import { Bot, session } from 'grammy';
import { run, RunnerHandle } from '@grammyjs/runner';
import Redis from 'ioredis';
import { BotContext, SessionData, BotInitConfig } from './types';
import { RedisSessionAdapter } from './session-adapter';
import { Monitoring } from '@monorepo/monitoring';
import { ChannelVerificationService, PaymentService, YooKassaConfig } from './services';
import { AIService } from './services/ai-service';
import { RateLimitTracker } from './services/rate-limit-tracker';
import { ChatHandler } from './handlers/chat-handler';
import { PhotoHandler } from './handlers/photo-handler';
import { GroqClient } from './clients/groq-client';
import { GeminiClient } from './clients/gemini-client';
import { TokenService, db } from '@monorepo/shared';
import {
  authMiddleware,
  createErrorHandler,
  loggingMiddleware,
  i18nMiddleware,
} from './middleware';
import {
  handleStart,
  handleHelp,
  handleProfile,
  handleSubscription,
} from './commands';
import { handleTextMessage, handleCallbackQuery } from './handlers';

export interface AIConfig {
  groqApiKey: string;
  groqModel?: string;
  groqMaxTokens?: number;
  geminiApiKey: string;
  geminiModel?: string;
  geminiMaxTokens?: number;
}

/**
 * Initialize and configure Grammy bot with all middleware and handlers
 */
export function createBot(
  token: string,
  redis: Redis,
  monitoring: Monitoring,
  aiConfig: AIConfig,
  channelId?: string,
  yookassaConfig?: YooKassaConfig
): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  // Initialize channel verification service if channel ID is provided
  const channelVerification = channelId
    ? new ChannelVerificationService(bot, redis, monitoring, { channelId })
    : undefined;

  // Initialize payment service if YooKassa config is provided
  const paymentService = yookassaConfig
    ? new PaymentService(yookassaConfig, monitoring)
    : undefined;

  // Initialize AI clients
  const groqClient = new GroqClient({
    apiKey: aiConfig.groqApiKey,
    model: aiConfig.groqModel,
    maxTokens: aiConfig.groqMaxTokens,
    monitoring,
  });

  const geminiClient = new GeminiClient({
    apiKey: aiConfig.geminiApiKey,
    model: aiConfig.geminiModel,
    maxTokens: aiConfig.geminiMaxTokens,
    monitoring,
  });

  // Initialize rate limit tracker
  const rateLimitTracker = new RateLimitTracker(redis, monitoring);

  // Initialize AI service
  const aiService = new AIService({
    groqClient,
    geminiClient,
    rateLimitTracker,
    monitoring,
  });

  // Initialize token service
  const tokenService = new TokenService(db);

  // Initialize chat and photo handlers
  const chatHandler = new ChatHandler({
    aiService,
    tokenService,
  });

  const photoHandler = new PhotoHandler({
    aiService,
    tokenService,
  });

  // Set up session storage with Redis
  const sessionAdapter = new RedisSessionAdapter(redis, {
    prefix: 'bot:session:',
    ttl: 3600, // 1 hour
  });

  // Session middleware (must be first after logging)
  bot.use(
    session({
      initial: (): SessionData => ({}),
      storage: {
        read: (key) => sessionAdapter.read(key),
        write: (key, value) => sessionAdapter.write(key, value),
        delete: (key) => sessionAdapter.delete(key),
      },
    })
  );

  // Logging middleware
  bot.use(loggingMiddleware(monitoring));

  // I18n middleware - must come after session but before auth
  bot.use(i18nMiddleware);

  // Inject channel verification service into context
  if (channelVerification) {
    bot.use(async (ctx, next) => {
      ctx.channelVerification = channelVerification;
      await next();
    });
  }

  // Inject payment service into context
  if (paymentService) {
    bot.use(async (ctx, next) => {
      ctx.paymentService = paymentService;
      await next();
    });
  }

  // Inject AI handlers into context
  bot.use(async (ctx, next) => {
    ctx.chatHandler = chatHandler;
    ctx.photoHandler = photoHandler;
    await next();
  });

  // Auth middleware - loads user from database
  bot.use(authMiddleware());

  // Register commands
  bot.command('start', (ctx) => handleStart(ctx, monitoring));
  bot.command('help', (ctx) => handleHelp(ctx));
  bot.command('profile', (ctx) => handleProfile(ctx));
  bot.command('subscription', (ctx) => handleSubscription(ctx));

  // Handle callback queries (inline keyboard button presses)
  if (paymentService) {
    bot.on('callback_query:data', (ctx) => handleCallbackQuery(ctx, paymentService));
  }

  // Handle text messages (keyboard buttons)
  bot.on('message:text', handleTextMessage);

  // Handle photo messages
  bot.on('message:photo', async (ctx) => {
    if (ctx.photoHandler) {
      await ctx.photoHandler.handle(ctx);
    } else {
      await ctx.reply('Photo handler not available');
    }
  });

  // Handle unsupported message types
  bot.on('message', async (ctx) => {
    await ctx.reply(
      '❓ Sorry, I only support text and photo messages. Please use the menu buttons or send a photo.'
    );
  });

  // Set error handler
  bot.catch(createErrorHandler(monitoring));

  return bot;
}

/**
 * Start bot in polling mode (for development)
 */
export async function startPolling(
  bot: Bot<BotContext>,
  monitoring: Monitoring
): Promise<RunnerHandle> {
  monitoring.logger.info('Starting bot in polling mode...');

  // Start bot with runner for graceful shutdown support
  const runner = run(bot, {
    runner: {
      fetch: {
        allowed_updates: ['message', 'callback_query', 'inline_query'],
      },
    },
  });

  monitoring.logger.info('Bot started successfully in polling mode');

  return runner;
}

/**
 * Start bot in webhook mode (for production)
 */
export async function startWebhook(
  bot: Bot<BotContext>,
  config: BotInitConfig,
  monitoring: Monitoring
): Promise<void> {
  if (!config.webhookDomain || !config.webhookPath) {
    throw new Error('Webhook domain and path are required for webhook mode');
  }

  const webhookUrl = `https://${config.webhookDomain}${config.webhookPath}`;

  monitoring.logger.info({ webhookUrl }, 'Setting up webhook...');

  await bot.api.setWebhook(webhookUrl, {
    secret_token: config.webhookSecret,
    allowed_updates: ['message', 'callback_query', 'inline_query'],
  });

  monitoring.logger.info('Webhook set successfully');
}

/**
 * Stop bot gracefully
 */
export async function stopBot(
  bot: Bot<BotContext>,
  runner: RunnerHandle | null,
  monitoring: Monitoring
): Promise<void> {
  monitoring.logger.info('Stopping bot...');

  // Stop runner if in polling mode
  if (runner) {
    await runner.stop();
  }

  // Delete webhook if exists
  try {
    await bot.api.deleteWebhook();
  } catch (error) {
    // Ignore error if webhook doesn't exist
  }

  monitoring.logger.info('Bot stopped successfully');
}
