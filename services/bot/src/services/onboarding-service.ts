import { db } from '@monorepo/shared';
import { SubscriptionTier, OperationType, User } from '@monorepo/database';

export interface OnboardingResult {
  user: User;
  isNewUser: boolean;
  tokensAwarded: number;
  message: string;
}

export interface GiftEligibilityCheck {
  eligible: boolean;
  reason?: string;
  daysSinceLastClaim?: number;
}

/**
 * Check if user is eligible for monthly gift tokens
 */
export function checkGiftEligibility(user: User): GiftEligibilityCheck {
  if (user.tier !== SubscriptionTier.Gift) {
    return {
      eligible: false,
      reason: 'User is not on Gift tier',
    };
  }

  if (!user.lastGiftClaimAt) {
    return {
      eligible: true,
    };
  }

  const now = new Date();
  const lastClaim = new Date(user.lastGiftClaimAt);
  const daysSinceClaim = Math.floor((now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceClaim >= 30) {
    return {
      eligible: true,
      daysSinceLastClaim: daysSinceClaim,
    };
  }

  return {
    eligible: false,
    reason: 'Monthly gift already claimed',
    daysSinceLastClaim: daysSinceClaim,
  };
}

/**
 * Award gift tokens to user
 */
export async function awardGiftTokens(userId: string, amount: number): Promise<User> {
  return await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const balanceBefore = user.tokensBalance;
    const balanceAfter = balanceBefore + amount;

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        tokensBalance: balanceAfter,
        lastGiftClaimAt: new Date(),
      },
    });

    await tx.tokenOperation.create({
      data: {
        userId,
        operationType: OperationType.monthly_reset,
        tokensAmount: amount,
        balanceBefore,
        balanceAfter,
        metadata: {
          source: 'monthly_gift',
          tier: user.tier,
        },
      },
    });

    return updatedUser;
  });
}

/**
 * Process user onboarding - handles both new and returning users
 */
export async function processUserOnboarding(user: User): Promise<OnboardingResult> {
  const isNewUser = !user.lastGiftClaimAt && user.tier === SubscriptionTier.Gift;
  
  if (isNewUser) {
    const giftAmount = 100;
    const updatedUser = await awardGiftTokens(user.id, giftAmount);
    
    return {
      user: updatedUser,
      isNewUser: true,
      tokensAwarded: giftAmount,
      message: buildWelcomeMessage(updatedUser, giftAmount),
    };
  }

  const eligibility = checkGiftEligibility(user);
  
  if (eligibility.eligible) {
    const giftAmount = 100;
    const updatedUser = await awardGiftTokens(user.id, giftAmount);
    
    return {
      user: updatedUser,
      isNewUser: false,
      tokensAwarded: giftAmount,
      message: buildMonthlyRenewalMessage(updatedUser, giftAmount),
    };
  }

  return {
    user,
    isNewUser: false,
    tokensAwarded: 0,
    message: buildReturningUserMessage(user),
  };
}

/**
 * Build welcome message for new users
 */
function buildWelcomeMessage(user: User, tokensAwarded: number): string {
  return `
🎉 *Welcome to AI Bot!*

Hello ${user.firstName || 'there'}! Your account has been created successfully.

✨ *You've received ${tokensAwarded} free tokens!*

🎯 *What you can do:*
• 🎨 Generate images with DALL-E (10 tokens)
• 🎬 Create videos with Sora (10 tokens)
• 💬 Chat with GPT-4 (5 tokens per message)

📋 *Your Current Plan:* ${user.tier}
💰 *Token Balance:* ${user.tokensBalance}

${user.tier === SubscriptionTier.Gift ? '\n⚠️ *Important:* To use the free tier, you need to subscribe to our channel.\nUse /subscription to learn more and subscribe.' : ''}

Use the menu below to get started! 👇
`.trim();
}

/**
 * Build message for monthly token renewal
 */
function buildMonthlyRenewalMessage(user: User, tokensAwarded: number): string {
  return `
🎁 *Monthly Tokens Renewed!*

Welcome back, ${user.firstName || 'there'}!

You've received your monthly ${tokensAwarded} tokens! 🎉

📋 *Your Current Plan:* ${user.tier}
💰 *Token Balance:* ${user.tokensBalance}

${user.tier === SubscriptionTier.Gift ? '\n⚠️ *Remember:* Make sure you\'re subscribed to our channel to continue using the free tier.' : ''}

Ready to create something amazing? 🚀
`.trim();
}

/**
 * Build message for returning users (no token award)
 */
function buildReturningUserMessage(user: User): string {
  const daysUntilRenewal = user.lastGiftClaimAt 
    ? 30 - Math.floor((new Date().getTime() - new Date(user.lastGiftClaimAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return `
👋 *Welcome back, ${user.firstName || 'there'}!*

📋 *Your Current Plan:* ${user.tier}
💰 *Token Balance:* ${user.tokensBalance}

${user.tier === SubscriptionTier.Gift ? `\n🎁 *Next monthly tokens:* ${daysUntilRenewal} days\n⚠️ *Remember:* Keep your channel subscription active to continue using the free tier.` : ''}

${user.tokensBalance === 0 ? '\n💎 Running low on tokens? Check out /subscription for upgrade options!' : ''}

Use the menu below to continue! 👇
`.trim();
}
