# Conversational Chat Feature

This document describes the conversational chat feature implementation in the Telegram bot.

## Overview

The chat feature provides users with intelligent AI-powered conversations that maintain context across messages. It supports both text and image inputs, with proper token management, rate limiting, and conversation history tracking.

## Features

### 1. Context Management

- **Conversation History**: Maintains up to 10 previous messages (5 exchanges) in session
- **Conversation ID**: Each conversation thread has a unique UUID
- **Multi-turn Conversations**: AI responses consider previous messages for context-aware replies
- **History Persistence**: Conversation history stored in Redis session (1 hour TTL)

### 2. Per-Message Token Deduction

- **Cost**: 5 tokens per message (both text and image analysis)
- **Pre-flight Check**: Verifies user has sufficient tokens before sending to AI
- **Atomic Operation**: Tokens deducted only after successful AI response
- **Transparent Billing**: Token cost included in operation metadata

### 3. Image Support

- **Vision Analysis**: Send photos with captions for AI-powered image analysis
- **Provider**: Uses Gemini Flash 2.5 for vision tasks
- **Context Integration**: Image analysis messages included in conversation history
- **Metadata Tracking**: Image messages flagged with `hasImage: true` in database

### 4. Streaming & Typing Indicators

- **Streaming Support**: Real-time streaming of AI responses (optional)
- **Typing Indicators**: Shows "typing..." every 5 seconds during streaming
- **Progressive Updates**: Message updated every 50 characters during streaming
- **Fallback**: Non-streaming mode available for faster simple responses

### 5. Database Logging

- **ChatMessage Model**: All messages logged to PostgreSQL
- **User Messages**: Includes content, tokens used, and conversation ID
- **Assistant Messages**: Includes model info and provider metadata
- **Queryable History**: Full conversation history available for analytics

### 6. Rate Limiting

- **Provider Limits**:
  - Groq (text): 14,400 requests/day, 300 requests/minute
  - Gemini (vision): 1,500 requests/day, 15 requests/minute
- **Redis Tracking**: Rate limit counters stored in Redis with daily/minute expiry
- **User Feedback**: Clear error messages when rate limits exceeded
- **Graceful Fallback**: Prevents token deduction when rate limited

## Commands

### /chat

Start or continue a conversation with the AI bot.

```
/chat
```

**Responses:**
- New conversation: Shows welcome message with instructions
- Existing conversation: Shows message count and continuation info

### /chatclear

Clear the current conversation history and start fresh.

```
/chatclear
```

**Response:** Confirmation that conversation history was reset

## Usage Examples

### Text Conversation

```
User: /chat
Bot: 💬 Conversational Chat Started
     You can now send me any message and I'll respond!
     ...

User: What is the capital of France?
Bot: The capital of France is Paris.

User: Tell me more about it
Bot: Paris is the largest city in France and has been the country's capital since...
```

### Image Analysis

```
User: [Sends photo with caption "What's in this image?"]
Bot: I see a beautiful sunset over the ocean with palm trees in the foreground...

User: What colors do you see?
Bot: The image features warm colors like orange, red, and yellow in the sky...
```

## Architecture

### Components

1. **ChatHandler** (`handlers/chat-handler.ts`)
   - Manages text-based conversations
   - Handles streaming responses
   - Logs messages to database
   - Updates session context

2. **PhotoHandler** (`handlers/photo-handler.ts`)
   - Processes image uploads
   - Downloads images from Telegram
   - Sends to Gemini Vision API
   - Integrates with conversation history

3. **AIService** (`services/ai-service.ts`)
   - Provider abstraction layer
   - Routes text to Groq
   - Routes vision to Gemini
   - Handles rate limiting

4. **Session Storage**
   - Redis-based session management
   - 1 hour TTL per session
   - Stores conversation context
   - Automatic cleanup

### Data Flow

```
User Message → Bot Context
              ↓
         Token Check (TokenService)
              ↓
    Conversation History (Session)
              ↓
         AI Service (Groq/Gemini)
              ↓
      Token Deduction (TokenService)
              ↓
     Database Logging (ChatMessage)
              ↓
   Context Update (Session)
              ↓
        Reply to User
```

## Configuration

### Environment Variables

Already configured in bot service:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-70b-versatile
GROQ_MAX_TOKENS=2048

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash
GEMINI_MAX_TOKENS=2048
```

### Constants

In `ChatHandler`:
- `MAX_CONTEXT_MESSAGES = 10` - Maximum messages kept in context

## Database Schema

### ChatMessage Model

```prisma
model ChatMessage {
  id             String   @id @default(uuid())
  createdAt      DateTime @default(now())
  userId         String
  role           String   // 'user', 'assistant', 'system'
  content        String
  model          String?
  tokensUsed     Int?
  conversationId String?
  metadata       Json?
  
  user User @relation(...)
  
  @@index([userId])
  @@index([conversationId])
  @@index([createdAt])
}
```

### Metadata Examples

**User Message:**
```json
{
  "provider": "groq",
  "model": "llama-3.1-70b-versatile",
  "hasImage": false
}
```

**Assistant Message:**
```json
{
  "provider": "groq",
  "streaming": true
}
```

**Vision Message:**
```json
{
  "provider": "gemini",
  "model": "gemini-1.5-flash",
  "hasImage": true,
  "vision": true
}
```

## Session Context Structure

```typescript
interface SessionData {
  conversationContext?: {
    lastCommand?: string;          // 'chat' or 'vision'
    lastPrompt?: string;            // Last assistant response
    messageCount?: number;          // Total messages in conversation
    conversationId?: string;        // UUID for this conversation
    history?: Array<{               // Last 10 messages
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>;
  };
}
```

## Error Handling

### Insufficient Tokens

```
❌ Insufficient tokens. You need 5 tokens but have 2 tokens.

Upgrade your plan: /subscription
```

### Rate Limit Exceeded

```
⚠️ Rate limit exceeded. Please try again later.
```

### AI Service Error

```
❌ AI Error: API connection failed
```

## Testing

### Unit Tests

- `chat-integration.test.ts` - Comprehensive chat handler tests
- `photo-integration.test.ts` - Photo handler with context tests
- `chat-commands.test.ts` - Command handler tests

### Test Coverage

- ✅ New conversation flow
- ✅ Context maintenance across messages
- ✅ Token quota checks
- ✅ Rate limiting scenarios
- ✅ Streaming with typing indicators
- ✅ Database logging
- ✅ Image analysis integration
- ✅ Error handling and fallbacks
- ✅ Context clearing

### Running Tests

```bash
# Run all bot tests
pnpm --filter bot test

# Run specific test file
pnpm --filter bot test chat-integration

# Watch mode
pnpm --filter bot test:watch

# Coverage
pnpm --filter bot test:coverage
```

## Internationalization

Messages support both English and Russian:

**English:**
- "Conversational Chat Started"
- "Continuing Conversation"
- "Conversation Cleared"

**Russian:**
- "Разговор начат"
- "Продолжение разговора"
- "Разговор очищен"

## Performance Considerations

### Session Storage

- Redis sessions expire after 1 hour
- History limited to 10 messages max
- Minimal memory footprint per user

### Rate Limiting

- Redis counters with TTL
- Separate tracking per provider
- Daily counters reset at 00:00 UTC

### Database

- Indexed on userId, conversationId, createdAt
- Efficient queries for history retrieval
- JSON metadata for flexible extension

## Future Enhancements

Possible improvements:

1. **Conversation Management**
   - List past conversations
   - Resume old conversations
   - Delete conversation history

2. **Advanced Features**
   - System prompts/personas
   - Temperature/creativity controls
   - Multi-modal responses (text + images)

3. **Analytics**
   - Conversation length statistics
   - Popular topics/queries
   - User engagement metrics

4. **Optimization**
   - Semantic caching
   - Response compression
   - Batch message processing

## Troubleshooting

### Context Not Maintained

**Issue:** Bot doesn't remember previous messages

**Solution:** 
- Check Redis connection
- Verify session TTL not expired
- Ensure session middleware loaded before handlers

### Rate Limits Hit Frequently

**Issue:** Users getting rate limit errors

**Solution:**
- Monitor provider usage in Redis
- Consider upgrading API tiers
- Implement user-level rate limiting

### High Token Consumption

**Issue:** Users running out of tokens quickly

**Solution:**
- Adjust MAX_CONTEXT_MESSAGES lower
- Implement conversation summarization
- Add per-conversation token limits

## Support

For questions or issues:
- Check bot logs: `pnpm --filter bot dev`
- Review test results: `pnpm --filter bot test`
- Monitor Redis: `redis-cli monitor`
- Check database: `pnpm db:studio`
