import { db } from '@monorepo/shared';
import { SubscriptionTier, OperationType, User } from '@monorepo/database';
import { I18n } from '../i18n';
import { ChannelVerificationService, ChannelMembershipResult } from './channel-verification-service';

export interface OnboardingResult {
  user: User;
  isNewUser: boolean;
  tokensAwarded: number;
  message: string;
  channelCheckRequired?: boolean;
  channelCheckPassed?: boolean;
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
 * Optionally checks channel membership for Gift tier users
 */
export async function processUserOnboarding(
  user: User,
  i18n: I18n,
  channelVerificationService?: ChannelVerificationService
): Promise<OnboardingResult> {
  const isNewUser = !user.lastGiftClaimAt && user.tier === SubscriptionTier.Gift;
  const isGiftTier = user.tier === SubscriptionTier.Gift;

  // Check channel membership for Gift tier users if service is provided
  if (isGiftTier && channelVerificationService) {
    const telegramId = parseInt(user.telegramId);
    const membershipResult = await channelVerificationService.checkMembership(telegramId);

    // If channel verification failed or user is not a member, return error message
    if (!membershipResult.isMember) {
      return {
        user,
        isNewUser: false,
        tokensAwarded: 0,
        message: buildChannelVerificationErrorMessage(membershipResult, i18n, channelVerificationService),
        channelCheckRequired: true,
        channelCheckPassed: false,
      };
    }
  }
  
  if (isNewUser) {
    const giftAmount = 100;
    const updatedUser = await awardGiftTokens(user.id, giftAmount);
    
    return {
      user: updatedUser,
      isNewUser: true,
      tokensAwarded: giftAmount,
      message: buildWelcomeMessage(updatedUser, giftAmount, i18n),
      channelCheckRequired: isGiftTier && !!channelVerificationService,
      channelCheckPassed: true,
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
      channelCheckRequired: isGiftTier && !!channelVerificationService,
      channelCheckPassed: true,
    };
  }

  return {
    user,
    isNewUser: false,
    tokensAwarded: 0,
    message: buildReturningUserMessage(user, i18n),
    channelCheckRequired: false,
    channelCheckPassed: undefined,
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

/**
 * Build error message for channel verification failures
 */
function buildChannelVerificationErrorMessage(
  result: ChannelMembershipResult,
  i18n: I18n,
  channelService: ChannelVerificationService
): string {
  const channel = channelService.formatChannelForMessage();

  switch (result.error) {
    case 'channel_not_configured':
      return i18n.channelVerification.channelNotConfigured;
    
    case 'rate_limit':
      return i18n.common.rateLimitExceeded.replace('{seconds}', '60');
    
    case 'user_not_found':
    case 'channel_private':
      return i18n.t('channelVerification.privateAccount');
    
    case 'api_error':
      return i18n.channelVerification.verificationError;
    
    default:
      // User left or was kicked
      if (result.status === 'left' || result.status === 'kicked') {
        return i18n.t('channelVerification.leftChannel', { channel });
      }
      // Default not subscribed message
      return i18n.t('channelVerification.notSubscribed', { channel });
  }
}
