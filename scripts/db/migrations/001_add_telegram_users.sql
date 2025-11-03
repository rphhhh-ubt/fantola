-- Migration: Add Telegram user fields and subscription/token management
-- Description: Extends users table to support Telegram bot with subscription tiers and token billing

-- Drop existing users table if needed (only for initial setup)
DROP TABLE IF EXISTS users CASCADE;

-- Create users table with Telegram and subscription support
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Telegram fields
  telegram_id VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  
  -- Subscription fields
  tier VARCHAR(50) NOT NULL DEFAULT 'Gift',
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Token billing fields
  tokens_balance INTEGER NOT NULL DEFAULT 0,
  tokens_spent INTEGER NOT NULL DEFAULT 0,
  
  -- Channel subscription
  channel_subscribed_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT valid_tier CHECK (tier IN ('Gift', 'Professional', 'Business')),
  CONSTRAINT positive_tokens_balance CHECK (tokens_balance >= 0),
  CONSTRAINT positive_tokens_spent CHECK (tokens_spent >= 0)
);

-- Create indexes for common queries
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_tier ON users(tier);
CREATE INDEX idx_users_subscription_expires_at ON users(subscription_expires_at);
CREATE INDEX idx_users_channel_subscribed_at ON users(channel_subscribed_at);

-- Create updated_at trigger
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create token operations log table for auditing
CREATE TABLE IF NOT EXISTS token_operations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_type VARCHAR(50) NOT NULL,
  tokens_amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_operation_type CHECK (
    operation_type IN ('image_generation', 'sora_image', 'chatgpt_message', 'refund', 'purchase', 'monthly_reset')
  )
);

CREATE INDEX idx_token_operations_user_id ON token_operations(user_id);
CREATE INDEX idx_token_operations_created_at ON token_operations(created_at);

-- Create subscription history table
CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier VARCHAR(50) NOT NULL,
  price_rubles INTEGER,
  payment_method VARCHAR(50),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT valid_subscription_tier CHECK (tier IN ('Gift', 'Professional', 'Business'))
);

CREATE INDEX idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX idx_subscription_history_expires_at ON subscription_history(expires_at);

-- Insert sample users for testing
INSERT INTO users (telegram_id, username, first_name, tier, tokens_balance, tokens_spent, channel_subscribed_at)
VALUES
  ('123456789', 'testuser1', 'John', 'Gift', 100, 0, CURRENT_TIMESTAMP),
  ('987654321', 'testuser2', 'Jane', 'Professional', 2000, 0, CURRENT_TIMESTAMP),
  ('555555555', 'testuser3', 'Bob', 'Business', 10000, 0, CURRENT_TIMESTAMP)
ON CONFLICT (telegram_id) DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Add helpful comments
COMMENT ON TABLE users IS 'Telegram bot users with subscription and token management';
COMMENT ON COLUMN users.telegram_id IS 'Unique Telegram user ID';
COMMENT ON COLUMN users.tier IS 'Subscription tier: Gift (free), Professional (1990₽), Business (3490₽)';
COMMENT ON COLUMN users.tokens_balance IS 'Current token balance for operations';
COMMENT ON COLUMN users.tokens_spent IS 'Total tokens spent lifetime';
COMMENT ON COLUMN users.channel_subscribed_at IS 'When user subscribed to the channel (required for Gift tier)';

COMMENT ON TABLE token_operations IS 'Audit log of all token operations';
COMMENT ON TABLE subscription_history IS 'History of subscription purchases and changes';
