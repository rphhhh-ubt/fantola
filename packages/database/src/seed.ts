import { PrismaClient, SubscriptionTier } from '@prisma/client';

export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  // Seed subscription tier configurations
  await prisma.subscriptionTierConfig.upsert({
    where: { tier: SubscriptionTier.Gift },
    update: {},
    create: {
      tier: SubscriptionTier.Gift,
      monthlyTokens: 100,
      priceRubles: null,
      requestsPerMinute: 10,
      burstPerSecond: 3,
      requiresChannel: true,
      description: 'Бесплатный тариф с 100 токенами в месяц. Требуется подписка на канал.',
      isActive: true,
    },
  });

  await prisma.subscriptionTierConfig.upsert({
    where: { tier: SubscriptionTier.Professional },
    update: {},
    create: {
      tier: SubscriptionTier.Professional,
      monthlyTokens: 2000,
      priceRubles: 1990,
      requestsPerMinute: 50,
      burstPerSecond: 10,
      requiresChannel: false,
      description: 'Профессиональный тариф с 2000 токенами в месяц за 1990₽.',
      isActive: true,
    },
  });

  await prisma.subscriptionTierConfig.upsert({
    where: { tier: SubscriptionTier.Business },
    update: {},
    create: {
      tier: SubscriptionTier.Business,
      monthlyTokens: 10000,
      priceRubles: 3490,
      requestsPerMinute: 100,
      burstPerSecond: 20,
      requiresChannel: false,
      description: 'Бизнес тариф с 10000 токенами в месяц за 3490₽.',
      isActive: true,
    },
  });
}
