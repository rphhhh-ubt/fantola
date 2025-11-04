import { BotContext } from '../types';
import { buildMainMenuKeyboard, getButtonLabels } from '../keyboards';

/**
 * Handle text messages - primarily keyboard button presses
 */
export async function handleTextMessage(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  const i18n = ctx.i18n;
  const buttons = getButtonLabels(i18n);

  if (!text) {
    return;
  }

  // Match button by comparing with all language variants
  if (isButtonMatch(text, buttons.productCard)) {
    await handleProductCard(ctx);
  } else if (isButtonMatch(text, buttons.soraImage)) {
    await handleSoraImage(ctx);
  } else if (isButtonMatch(text, buttons.chatGpt)) {
    await handleChatGPT(ctx);
  } else if (isButtonMatch(text, buttons.myProfile)) {
    await handleMyProfile(ctx);
  } else if (isButtonMatch(text, buttons.subscription)) {
    await handleSubscriptionButton(ctx);
  } else if (isButtonMatch(text, buttons.support)) {
    await handleSupport(ctx);
  } else if (isButtonMatch(text, buttons.channel)) {
    await handleChannel(ctx);
  } else if (isButtonMatch(text, buttons.userChat)) {
    await handleUserChat(ctx);
  } else if (isButtonMatch(text, buttons.backToMenu)) {
    await handleBackToMenu(ctx);
  } else {
    // Not a button - treat as chat message
    if (ctx.chatHandler) {
      await ctx.chatHandler.handle(ctx, text);
    } else {
      // Fallback if chat handler not available
      await ctx.reply(i18n.common.unknownCommand, {
        reply_markup: buildMainMenuKeyboard(i18n),
      });
    }
  }
}

/**
 * Check if text matches button label (case-insensitive, trimmed)
 */
function isButtonMatch(text: string, buttonLabel: string): boolean {
  return text.trim().toLowerCase() === buttonLabel.trim().toLowerCase();
}

async function handleProductCard(ctx: BotContext): Promise<void> {
  const i18n = ctx.i18n;
  const feature = i18n.features.productCard;

  const message = [
    feature.title,
    '',
    feature.description,
    '',
    ...feature.features,
    feature.cost,
    feature.comingSoon,
  ].join('\n');

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleSoraImage(ctx: BotContext): Promise<void> {
  const i18n = ctx.i18n;
  const feature = i18n.features.soraImage;

  const message = [
    feature.title,
    '',
    feature.description,
    '',
    ...feature.features,
    feature.cost,
    feature.comingSoon,
  ].join('\n');

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleChatGPT(ctx: BotContext): Promise<void> {
  const i18n = ctx.i18n;
  const feature = i18n.features.chatGpt;

  const message = [
    feature.title,
    '',
    feature.description,
    '',
    ...feature.features,
    feature.cost,
    feature.comingSoon,
  ].join('\n');

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleMyProfile(ctx: BotContext): Promise<void> {
  const user = ctx.user;
  const i18n = ctx.i18n;

  if (!user) {
    await ctx.reply(i18n.common.profileError);
    return;
  }

  const profileMessage = `
${i18n.commands.profile.title}

${i18n.commands.profile.name} ${user.firstName || 'N/A'}
${i18n.commands.profile.currentTier} ${user.tier}
${i18n.commands.profile.available} ${user.tokensBalance} ${i18n.common.tokens}

${i18n.t('commands.help.contact')}
  `.trim();

  await ctx.reply(profileMessage, { parse_mode: 'Markdown' });
}

async function handleSubscriptionButton(ctx: BotContext): Promise<void> {
  const i18n = ctx.i18n;
  await ctx.reply(i18n.t('commands.help.contact'), {
    parse_mode: 'Markdown',
  });
}

async function handleSupport(ctx: BotContext): Promise<void> {
  const i18n = ctx.i18n;
  const feature = i18n.features.support;

  const message = [
    feature.title,
    '',
    feature.description,
    '',
    ...feature.options,
    feature.contactPrompt,
  ].join('\n');

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleChannel(ctx: BotContext): Promise<void> {
  const i18n = ctx.i18n;
  const feature = i18n.features.channel;

  // Example channel - replace with actual channel
  const channelLink = '@your_channel';

  const message = [
    feature.title,
    '',
    feature.description,
    '',
    ...feature.benefits,
    i18n.t('features.channel.action', { channel: channelLink }),
  ].join('\n');

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleUserChat(ctx: BotContext): Promise<void> {
  const i18n = ctx.i18n;
  const feature = i18n.features.userChat;

  const message = [
    feature.title,
    '',
    feature.description,
    '',
    feature.prompt,
    feature.comingSoon,
  ].join('\n');

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleBackToMenu(ctx: BotContext): Promise<void> {
  const i18n = ctx.i18n;
  await ctx.reply(i18n.common.backToMenu, {
    reply_markup: buildMainMenuKeyboard(i18n),
  });
}
