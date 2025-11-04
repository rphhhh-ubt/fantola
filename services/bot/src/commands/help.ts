import { CommandContext } from 'grammy';
import { BotContext } from '../types';

/**
 * Handle /help command
 * Show available commands and features
 */
export async function handleHelp(ctx: CommandContext<BotContext>): Promise<void> {
  const i18n = ctx.i18n;

  const helpMessage = [
    i18n.commands.help.title,
    '',
    ...i18n.commands.help.commands,
    i18n.commands.help.features,
    '',
    ...i18n.commands.help.featureList,
    i18n.commands.help.contact,
  ].join('\n');

  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
}
