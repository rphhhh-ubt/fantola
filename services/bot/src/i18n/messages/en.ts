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

  // Product card messages
  productCard: {
    start: '🎨 *Product Card Generator*\n\n' +
      'Create professional product images with AI!\n\n' +
      '📸 Please send me a photo of your product to get started.\n\n' +
      '💰 Cost: *10 tokens* per generation',
    photoReceived: '✅ Photo received!\n\n' +
      'Choose a card mode:\n' +
      '• *Clean* - Minimal, professional look\n' +
      '• *Infographics* - Data-rich, detailed view',
    noPhoto: 'No photo found in message',
    modeSelected: '✅ Mode selected: *{mode}*\n\n' +
      'Optional: Customize your card\n' +
      '• Add custom background\n' +
      '• Set product pose/angle\n' +
      '• Add text (headline, subheadline, description)\n\n' +
      'Or generate with defaults!',
    clean: 'Clean',
    infographics: 'Infographics',
    promptBackground: '🎨 Describe the background you want (e.g., "white studio", "outdoor nature", "gradient blue")',
    promptPose: '📐 Describe the product pose/angle (e.g., "front view", "45 degree angle", "floating")',
    promptText: '✍️ Enter text in format:\nHeadline | Subheadline | Description\n\nExample:\nNew Product | Best Quality | Description here',
    optionSaved: '✅ Option saved!\n\nContinue customizing or generate now.',
    startOver: 'Please start over by sending a product photo.',
    generating: '⏳ Generating your product card...',
    generationStarted: '✅ *Generation Started!*\n\n' +
      'Generation ID: `{id}`\n\n' +
      'I\'ll notify you when it\'s ready. This usually takes 1-2 minutes.',
    generationReady: '✅ *Product Card Ready!*\n\n' +
      'Your product card has been generated successfully!',
    generatingMore: '⏳ Generating more variants...',
    newGenerationStarted: '✅ *New Generation Started!*\n\n' +
      'Generation ID: `{id}`\n\n' +
      'I\'ll notify you when it\'s ready.',
    editCard: '✏️ *Edit Card*\n\n' +
      'What would you like to change?',
    noChanges: 'No changes to apply.',
    applyingChanges: '⏳ Applying changes...',
    editApplied: '✅ *Edit Applied!*\n\n' +
      'Generation ID: `{id}`\n\n' +
      'I\'ll notify you when it\'s ready.',
    moderationFailed: '❌ Content moderation failed: {reason}',
    handlerNotAvailable: 'Product card handler not available',
    buttons: {
      clean: '✨ Clean',
      infographics: '📊 Infographics',
      addBackground: '🎨 Add Background',
      setPose: '📐 Set Pose',
      addText: '✍️ Add Text',
      generateNow: '✅ Generate Now',
      generateMore: '🔄 Generate More',
      editCard: '✏️ Edit Card',
      changeBackground: '🎨 Change Background',
      changePose: '📐 Change Pose',
      changeText: '✍️ Change Text',
      applyChanges: '✅ Apply Changes',
    },
  },

  // Callback messages
  callback: {
    invalidData: 'Invalid callback data',
    unknownAction: 'Unknown action',
    giftCannotBuy: 'Gift tier is free and cannot be purchased',
    alreadySubscribed: 'You already have an active {tier} subscription',
    subscriptionPayment: '💳 *Subscription Payment*',
    plan: 'Plan: *{tier}*',
    amount: '💰 Amount: *{amount}₽*',
    clickToPay: '👉 Click the button below to proceed with payment:',
    payNow: '💳 Pay Now',
    paymentCreationFailed: '❌ Failed to create payment. Please try again later.',
    tierDescriptions: {
      professional: '2000 tokens/month, priority support',
      business: '10000 tokens/month, premium support',
    },
  },

  // Payment webhook messages
  payment: {
    success: '✅ *Payment Successful!*',
    activated: '🎉 Your *{tier}* subscription has been activated!',
    tokensAdded: '💎 *{tokens}* tokens have been added to your balance.',
    expiresOn: '📅 Expires on: *{date}*',
    startUsing: '👉 Start using your subscription with /start',
    canceled: '❌ *Payment Canceled*',
    canceledMessage: 'Your payment has been canceled.',
    tryAgain: '💡 You can try again anytime with /subscription',
    error: '❌ *Payment Error*',
    errorMessage: 'There was an error processing your payment.',
    contactSupport: '💡 Please try again or contact support: /help',
  },
};

export type Messages = typeof en;
