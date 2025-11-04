import { Bot, session } from 'grammy';
import { run, RunnerHandle } from '@grammyjs/runner';
import Redis from 'ioredis';
import { BotContext, SessionData, BotInitConfig } from './types';
import { RedisSessionAdapter } from './session-adapter';
import { Monitoring } from '@monorepo/monitoring';
import { ChannelVerificationService, PaymentService, YooKassaConfig } from './services';
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

/**
 * Initialize and configure Grammy bot with all middleware and handlers
 */
export function createBot(
  token: string,
  redis: Redis,
  monitoring: Monitoring,
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

  // Handle unsupported message types
  bot.on('message', async (ctx) => {
    await ctx.reply(
      '❓ Sorry, I only support text messages at the moment. Please use the menu buttons.'
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
