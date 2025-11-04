import { db } from '@monorepo/shared';
import { SubscriptionTier, OperationType, User } from '@monorepo/database';
import { I18n } from '../i18n';

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
export async function processUserOnboarding(user: User, i18n: I18n): Promise<OnboardingResult> {
  const isNewUser = !user.lastGiftClaimAt && user.tier === SubscriptionTier.Gift;
  
  if (isNewUser) {
    const giftAmount = 100;
    const updatedUser = await awardGiftTokens(user.id, giftAmount);
    
    return {
      user: updatedUser,
      isNewUser: true,
      tokensAwarded: giftAmount,
      message: buildWelcomeMessage(updatedUser, giftAmount, i18n),
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
      message: buildMonthlyRenewalMessage(updatedUser, giftAmount, i18n),
    };
  }

  return {
    user,
    isNewUser: false,
    tokensAwarded: 0,
    message: buildReturningUserMessage(user, i18n),
  };
}

/**
 * Build welcome message for new users
 */
function buildWelcomeMessage(user: User, tokensAwarded: number, i18n: I18n): string {
  const messages = [
    i18n.commands.start.welcome,
    '',
    ...i18n.commands.start.features,
    '',
    i18n.t('commands.start.newUser', { tokens: tokensAwarded }),
  ];

  if (user.tier === SubscriptionTier.Gift) {
    messages.push(i18n.t('commands.start.channelSubscription', { channel: '@your_channel' }));
  }

  return messages.join('\n');
}

/**
 * Build message for monthly token renewal
 */
function buildMonthlyRenewalMessage(user: User, tokensAwarded: number, i18n: I18n): string {
  const messages = [
    i18n.commands.start.welcome,
    '',
    i18n.t('commands.start.monthlyRenewal', { tokens: tokensAwarded }),
  ];

  if (user.tier === SubscriptionTier.Gift) {
    messages.push('');
    messages.push(i18n.t('commands.start.channelSubscription', { channel: '@your_channel' }));
  }

  return messages.join('\n');
}

/**
 * Build message for returning users (no token award)
 */
function buildReturningUserMessage(user: User, i18n: I18n): string {
  const daysUntilRenewal = user.lastGiftClaimAt 
    ? 30 - Math.floor((new Date().getTime() - new Date(user.lastGiftClaimAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const messages = [
    i18n.commands.start.welcome,
    '',
    ...i18n.commands.start.features,
  ];

  if (user.tier === SubscriptionTier.Gift && daysUntilRenewal > 0) {
    messages.push('');
    messages.push(i18n.t('commands.start.nextRenewal', { days: daysUntilRenewal }));
  }

  return messages.join('\n');
}
