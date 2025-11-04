# Telegram Channel Verification

This document describes the Telegram channel verification feature that enforces channel subscription requirements for Gift tier users.

## Overview

The channel verification system uses Telegram Bot API's `getChatMember` method to check if Gift tier users are subscribed to a required channel. The feature includes:

- **Redis Caching**: Results are cached for 10 minutes to reduce API calls
- **Rate Limiting**: Prevents API abuse with configurable rate limits (default: 10 checks/minute)
- **Error Handling**: User-friendly messages for various error scenarios
- **Automatic Enforcement**: Integrated with onboarding and profile commands

## Configuration

### Environment Variable

Set the channel ID or username in your environment:

```bash
# Using channel username (recommended)
TELEGRAM_CHANNEL_ID=@your_channel

# Or using channel ID (numeric)
TELEGRAM_CHANNEL_ID=-1001234567890
```

**Note**: If `TELEGRAM_CHANNEL_ID` is not set, channel verification is disabled and Gift tier users can receive tokens without subscription.

### Getting Channel ID

To get your channel ID:

1. **Using Username**: If your channel has a public username, use `@username` format
2. **Using ID**: Forward a message from your channel to [@userinfobot](https://t.me/userinfobot) or [@getidsbot](https://t.me/getidsbot)

## How It Works

### Onboarding Flow

When a Gift tier user runs `/start`:

1. Bot checks if channel verification is configured
2. If configured, checks user's membership status (cache → API)
3. If user is a member → awards tokens
4. If user is not a member → shows subscription prompt

```
❌ You need to subscribe to our channel to use the Gift tier.

👉 Subscribe here: @your_channel

After subscribing, send /start again.
```

### Profile Command

The `/profile` command shows channel subscription status for Gift tier users:

```
📢 Channel subscription required for Gift tier
✅ Subscribed
```

Or if not subscribed:

```
📢 Channel subscription required for Gift tier
❌ Not subscribed

⚠️ You need to subscribe to our channel to use the Gift tier...
```

## Caching Strategy

- **Cache TTL**: 10 minutes (600 seconds)
- **Cache Key**: `channel:membership:{userId}`
- **Cached Data**: Both positive (member) and negative (not member) results

### Cache Invalidation

Cache is automatically invalidated on:
- Manual invalidation via `invalidateCache(userId)`
- TTL expiration (10 minutes)

## Rate Limiting

To prevent API abuse:

- **Window**: 60 seconds
- **Max Requests**: 10 per user per window
- **Tracking**: Redis with key `channel:ratelimit:{userId}`

When rate limit is exceeded:

```
⚠️ Rate limit exceeded. Please try again in 60 seconds.
```

## Error Handling

The system handles various error scenarios:

### User Left Channel

```
⚠️ You have left our channel. Please rejoin to continue using the Gift tier:

👉 @your_channel
```

### Private Account

```
❌ Your account privacy settings prevent us from verifying your channel subscription. 
Please adjust your settings or upgrade to a paid plan.
```

### Channel Not Configured

```
⚠️ Channel verification is not configured. Please contact support.
```

### API Error

```
❌ Unable to verify channel subscription. Please try again later.
```

## Member Status Types

Telegram API returns different member statuses:

| Status | Is Member? | Description |
|--------|-----------|-------------|
| `member` | ✅ Yes | Regular channel member |
| `administrator` | ✅ Yes | Channel administrator |
| `creator` | ✅ Yes | Channel creator/owner |
| `restricted` | ❌ No | Member with restrictions |
| `left` | ❌ No | User left the channel |
| `kicked` | ❌ No | User was banned |

## Integration Examples

### Using in Commands

```typescript
import { ChannelVerificationService } from './services/channel-verification-service';

// Service is available in context
const membershipResult = await ctx.channelVerification.checkMembership(userId);

if (!membershipResult.isMember) {
  await ctx.reply('Please subscribe to our channel first!');
  return;
}

// Proceed with command logic
```

### Manual Verification

```typescript
const service = new ChannelVerificationService(bot, redis, monitoring, {
  channelId: '@mychannel',
  cacheTtl: 600,
  rateLimitWindow: 60,
  rateLimitMax: 10,
});

const result = await service.checkMembership(userId);

if (result.isMember) {
  console.log('User is subscribed');
} else if (result.error) {
  console.error('Verification error:', result.error);
}
```

## Testing

Comprehensive test coverage includes:

- ✅ Membership status checks (member, admin, creator, left, kicked)
- ✅ Caching behavior and TTL
- ✅ Rate limiting enforcement
- ✅ Error handling (user not found, channel private, API errors)
- ✅ Cache expiry and invalidation
- ✅ Integration with onboarding flow
- ✅ Backwards compatibility (works without channel service)

Run tests:

```bash
# All bot tests
pnpm --filter @monorepo/bot test

# Channel verification tests only
pnpm --filter @monorepo/bot test channel-verification

# Onboarding integration tests
pnpm --filter @monorepo/bot test onboarding
```

## Monitoring

The service tracks KPIs for:

- `rate_limit_hit` - When users exceed rate limits
- Channel check success/failure rates
- API error frequencies

Logs include:
- Membership check results (debug level)
- Cache hits/misses (debug level)
- API errors (error level)
- Channel verification results (info level)

## Best Practices

1. **Set Channel Username**: Use public channel username (@channel) for easier user access
2. **Monitor Cache Hit Rate**: High cache hit rate = fewer API calls
3. **Adjust Rate Limits**: Increase limits if legitimate users are being blocked
4. **Handle Errors Gracefully**: Always show user-friendly error messages
5. **Test Before Deploying**: Verify channel ID is correct and bot has access

## Troubleshooting

### Bot Can't Access Channel

**Issue**: API error "chat not found"

**Solution**: Make sure:
1. Bot is added to the channel as administrator
2. Channel ID is correct (including @ for usernames)
3. Channel is not private without bot access

### Users Report "Not Subscribed" Despite Subscribing

**Issue**: Cache showing outdated status

**Solutions**:
1. Wait 10 minutes for cache to expire, or
2. Manually invalidate cache for affected users, or
3. Reduce cache TTL if this happens frequently

### Rate Limit Too Restrictive

**Issue**: Legitimate users hitting rate limits

**Solution**: Increase `rateLimitMax` in configuration:

```typescript
const service = new ChannelVerificationService(bot, redis, monitoring, {
  channelId: '@channel',
  rateLimitMax: 20, // Increase from default 10
});
```

## Security Considerations

1. **Privacy**: Bot needs permission to check channel membership
2. **Rate Limiting**: Prevents malicious users from spamming verification API
3. **Cache**: Reduces attack surface by limiting API calls
4. **Error Messages**: Don't expose sensitive information in errors

## Future Enhancements

Potential improvements:

- [ ] Support multiple required channels
- [ ] Configurable cache TTL per environment
- [ ] Webhook-based membership updates (instant verification)
- [ ] Admin dashboard for channel verification statistics
- [ ] Automatic retry with exponential backoff for API errors
- [ ] Grace period for users who just subscribed
