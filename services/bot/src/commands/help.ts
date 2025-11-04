import { CommandContext } from 'grammy';
import { BotContext } from '../types';

/**
 * Handle /help command
 * Show available commands and features
 */
export async function handleHelp(ctx: CommandContext<BotContext>): Promise<void> {
  const helpMessage = `
📚 *Available Commands*

/start - Start the bot and show main menu
/help - Show this help message
/profile - View your profile and token balance
/subscription - Manage your subscription

🎨 *Features*

• *Image Generation*: Create AI-generated images from text prompts
• *ChatGPT*: Have conversations with GPT-4
• *Token System*: Each action costs tokens based on your plan

💡 *Tips*

• Be specific in your prompts for better results
• Check your token balance regularly
• Upgrade your plan for more tokens and features

Need more help? Contact support at @support
  `.trim();

  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
}
