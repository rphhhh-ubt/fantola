/**
 * English language messages
 */
export const en = {
  // Menu buttons
  buttons: {
    productCard: '🎨 Product Card',
    soraImage: '🎬 Sora Image',
    chatGpt: '💬 ChatGPT',
    myProfile: '👤 My Profile',
    subscription: '💎 Buy Subscription',
    support: '❓ Support',
    channel: '📢 Channel',
    userChat: '💭 User Chat',
    backToMenu: '⬅️ Back to Menu',
    cancel: '❌ Cancel',
  },

  // Command messages
  commands: {
    start: {
      welcome: '👋 Welcome to AI Bot!\n\nI can help you with:',
      features: [
        '🎨 Generate images with DALL-E',
        '🎬 Create images with Sora',
        '💬 Chat with GPT-4',
        '💎 Manage your subscription',
      ],
      newUser: '\n🎁 As a new user, you received *{tokens}* free tokens!',
      monthlyRenewal: '\n🎁 Your monthly tokens have been renewed! You received *{tokens}* tokens.',
      nextRenewal: '\n⏰ Next token renewal in *{days}* days.',
      channelSubscription: '\n📢 Subscribe to our channel to keep your free tokens: {channel}',
    },
    help: {
      title: '📚 *Available Commands*',
      commands: [
        '/start - Start the bot and show main menu',
        '/profile - View your profile and token balance',
        '/subscription - Manage subscription plans',
        '/chat - Start or continue conversation',
        '/chatclear - Clear conversation history',
        '/help - Show this help message',
      ],
      features: '\n🎯 *Features*',
      featureList: [
        '🎨 Product Card - Generate images with DALL-E (10 tokens)',
        '🎬 Sora Image - Create images with Sora (10 tokens)',
        '💬 ChatGPT - Chat with AI (5 tokens per message)',
        '📷 Photo Analysis - Send photos with captions (5 tokens)',
        '💎 Subscription - Upgrade for more tokens',
      ],
      contact: '\n📞 Need help? Use the Support button or contact @support',
    },
    chat: {
      start: '💬 *Conversational Chat Started*\n\nYou can now send me any message and I\'ll respond! I\'ll remember our conversation context (last 10 messages).\n\n📸 You can also send photos with captions for image analysis.\n\n💰 Cost: *5 tokens* per message\n\n🔄 Use /chatclear to start a new conversation',
      continueConversation: '💬 *Continuing Conversation*\n\nWe have *{count}* messages in our current conversation. Keep chatting!\n\n🔄 Use /chatclear to start fresh',
      cleared: '✅ *Conversation Cleared*\n\nYour conversation history has been reset. You can start a new conversation now!',
    },
    profile: {
      title: '👤 *Your Profile*',
      name: '*Name:*',
      username: '*Username:*',
      telegramId: '*Telegram ID:*',
      subscriptionTitle: '\n💎 *Subscription*',
      currentTier: '*Current Tier:*',
      status: '*Status:*',
      tokenBalanceTitle: '\n🪙 *Token Balance*',
      available: '*Available:*',
      totalSpent: '*Total Spent:*',
      statisticsTitle: '\n📊 *Statistics*',
      memberSince: '*Member since:*',
      lastActive: '*Last active:*',
      statusActive: 'Active until {date}',
      statusExpired: 'Expired',
      statusNone: 'No active subscription',
    },
    subscription: {
      title: '💎 *Subscription Plans*',
      currentPlan: '\n*Current Plan:* {tier}',
      plans: {
        gift: '\n🎁 *Gift Tier* (Free)\n• 100 tokens/month\n• Requires channel subscription\n• 10 requests/minute',
        professional: '\n💎 *Professional* (1990₽/month)\n• 2000 tokens/month\n• 50 requests/minute\n• Priority support',
        business: '\n🏢 *Business* (3490₽/month)\n• 10000 tokens/month\n• 100 requests/minute\n• Premium support',
      },
      upgrade: '\n💡 Tap a plan below to upgrade:',
    },
  },

  // Feature messages
  features: {
    productCard: {
      title: '🎨 *Product Card Generation*',
      description: 'Generate professional product images using DALL-E 3.',
      features: [
        '• High quality 1024x1024 images',
        '• Natural language descriptions',
        '• Perfect for e-commerce',
      ],
      cost: '\n💰 Cost: *10 tokens* per image',
      comingSoon: '\n🚧 This feature is coming soon!',
    },
    soraImage: {
      title: '🎬 *Sora Image Generation*',
      description: 'Create stunning images with Sora AI.',
      features: [
        '• Cinematic quality',
        '• Video-to-image conversion',
        '• Unique artistic style',
      ],
      cost: '\n💰 Cost: *10 tokens* per image',
      comingSoon: '\n🚧 This feature is coming soon!',
    },
    chatGpt: {
      title: '💬 *ChatGPT*',
      description: 'Have natural conversations with GPT-4.',
      features: [
        '• Context-aware responses',
        '• Multiple conversation threads',
        '• Smart and helpful',
      ],
      cost: '\n💰 Cost: *5 tokens* per message',
      comingSoon: '\n🚧 This feature is coming soon!',
    },
    support: {
      title: '❓ *Support*',
      description: 'Need help? We\'re here for you!',
      options: [
        '📧 Email: support@aibot.example',
        '💬 Telegram: @support_bot',
        '📚 Documentation: https://docs.aibot.example',
      ],
      contactPrompt: '\nHow can we help you today?',
    },
    channel: {
      title: '📢 *Official Channel*',
      description: 'Join our channel for updates and news!',
      benefits: [
        '🎁 Free Gift tier tokens',
        '📰 Latest features and updates',
        '🎉 Exclusive promotions',
        '💡 Tips and tricks',
      ],
      action: '\n👉 Subscribe now: {channel}',
    },
    userChat: {
      title: '💭 *User Chat*',
      description: 'Chat with our support team.',
      prompt: 'Please describe your question or issue, and our team will respond shortly.',
      comingSoon: '\n🚧 This feature is coming soon!',
    },
  },

  // Common messages
  common: {
    backToMenu: '🏠 Back to main menu',
    unknownCommand: '❓ I didn\'t understand that. Please use the menu buttons below.',
    error: '❌ An error occurred. Please try again.',
    loading: '⏳ Processing...',
    success: '✅ Success!',
    insufficientTokens: '❌ Insufficient tokens. You need *{required}* tokens but have *{available}* tokens.\n\nUpgrade your plan: /subscription',
    rateLimitExceeded: '⚠️ Rate limit exceeded. Please try again later.',
    profileError: 'Unable to load profile. Please try again.',
    tokens: 'tokens',
    aiError: '❌ AI Error: {error}',
  },

  // Channel verification messages
  channelVerification: {
    notSubscribed: '❌ You need to subscribe to our channel to use the Gift tier.\n\n👉 Subscribe here: {channel}\n\nAfter subscribing, send /start again.',
    verificationError: '❌ Unable to verify channel subscription. Please try again later.',
    subscriptionRequired: '📢 Channel subscription required for Gift tier',
    checkingMembership: '⏳ Checking channel subscription...',
    leftChannel: '⚠️ You have left our channel. Please rejoin to continue using the Gift tier:\n\n👉 {channel}',
    privateAccount: '❌ Your account privacy settings prevent us from verifying your channel subscription. Please adjust your settings or upgrade to a paid plan.',
    channelNotConfigured: '⚠️ Channel verification is not configured. Please contact support.',
    status: {
      subscribed: '✅ Subscribed',
      notSubscribed: '❌ Not subscribed',
    },
  },
};

export type Messages = typeof en;
