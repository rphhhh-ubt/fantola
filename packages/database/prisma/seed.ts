import { PrismaClient, SubscriptionTier } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Seed subscription tier configurations
  console.log('📋 Seeding subscription tier configurations...');

  const giftTier = await prisma.subscriptionTierConfig.upsert({
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
      metadata: {
        features: [
          'Доступ к DALL-E',
          'Доступ к Sora',
          'Доступ к ChatGPT',
          'Базовая скорость генерации',
        ],
        limitations: [
          'Требуется подписка на канал',
          'Лимит 10 запросов в минуту',
          'Лимит 3 запроса в секунду (burst)',
        ],
      },
    },
  });
  console.log(`  ✓ Created/updated Gift tier: ${giftTier.id}`);

  const professionalTier = await prisma.subscriptionTierConfig.upsert({
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
      metadata: {
        features: [
          'Доступ ко всем AI инструментам',
          'Приоритетная обработка',
          'Повышенная скорость генерации',
          '2000 токенов в месяц',
        ],
        tokenCosts: {
          image_generation: 10,
          sora_image: 10,
          chatgpt_message: 5,
        },
        estimatedUsage: {
          images: 200,
          videos: 200,
          chatMessages: 400,
        },
      },
    },
  });
  console.log(`  ✓ Created/updated Professional tier: ${professionalTier.id}`);

  const businessTier = await prisma.subscriptionTierConfig.upsert({
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
      metadata: {
        features: [
          'Доступ ко всем AI инструментам',
          'Максимальный приоритет',
          'Максимальная скорость генерации',
          '10000 токенов в месяц',
          'Техподдержка',
        ],
        tokenCosts: {
          image_generation: 10,
          sora_image: 10,
          chatgpt_message: 5,
        },
        estimatedUsage: {
          images: 1000,
          videos: 1000,
          chatMessages: 2000,
        },
      },
    },
  });
  console.log(`  ✓ Created/updated Business tier: ${businessTier.id}`);

  // Seed test users
  console.log('\n👤 Seeding test users...');

  const testUser1 = await prisma.user.upsert({
    where: { telegramId: '123456789' },
    update: {},
    create: {
      telegramId: '123456789',
      username: 'testuser1',
      firstName: 'John',
      tier: SubscriptionTier.Gift,
      tokensBalance: 100,
      tokensSpent: 0,
      channelSubscribedAt: new Date(),
    },
  });
  console.log(`  ✓ Created/updated test user: ${testUser1.username} (Gift tier)`);

  const testUser2 = await prisma.user.upsert({
    where: { telegramId: '987654321' },
    update: {},
    create: {
      telegramId: '987654321',
      username: 'testuser2',
      firstName: 'Jane',
      tier: SubscriptionTier.Professional,
      tokensBalance: 2000,
      tokensSpent: 0,
      subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      channelSubscribedAt: new Date(),
    },
  });
  console.log(`  ✓ Created/updated test user: ${testUser2.username} (Professional tier)`);

  const testUser3 = await prisma.user.upsert({
    where: { telegramId: '555555555' },
    update: {},
    create: {
      telegramId: '555555555',
      username: 'testuser3',
      firstName: 'Bob',
      tier: SubscriptionTier.Business,
      tokensBalance: 10000,
      tokensSpent: 0,
      subscriptionExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      channelSubscribedAt: new Date(),
    },
  });
  console.log(`  ✓ Created/updated test user: ${testUser3.username} (Business tier)`);

  console.log('\n✅ Seed completed successfully!');
  console.log('\nSubscription Tiers:');
  console.log('  - Gift: 100 tokens/month (Free, requires channel subscription)');
  console.log('  - Professional: 2000 tokens/month (1990₽)');
  console.log('  - Business: 10000 tokens/month (3490₽)');
  console.log('\nToken Costs:');
  console.log('  - Image Generation (DALL-E, Stable Diffusion): 10 tokens');
  console.log('  - Sora Video: 10 tokens');
  console.log('  - ChatGPT Message: 5 tokens');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
