-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('Gift', 'Professional', 'Business');

-- CreateEnum
CREATE TYPE "OperationType" AS ENUM ('image_generation', 'sora_image', 'chatgpt_message', 'refund', 'purchase', 'monthly_reset');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'canceled', 'refunded');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('yookassa', 'stripe', 'manual');

-- CreateEnum
CREATE TYPE "GenerationTool" AS ENUM ('dalle', 'sora', 'stable_diffusion', 'chatgpt');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'canceled');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "telegram_id" VARCHAR(255) NOT NULL,
    "username" VARCHAR(255),
    "first_name" VARCHAR(255),
    "last_name" VARCHAR(255),
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'Gift',
    "subscription_expires_at" TIMESTAMPTZ,
    "tokens_balance" INTEGER NOT NULL DEFAULT 0,
    "tokens_spent" INTEGER NOT NULL DEFAULT 0,
    "channel_subscribed_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_operations" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL,
    "operation_type" "OperationType" NOT NULL,
    "tokens_amount" INTEGER NOT NULL,
    "balance_before" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "token_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_history" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL,
    "tier" "SubscriptionTier" NOT NULL,
    "price_rubles" INTEGER,
    "payment_method" VARCHAR(50),
    "started_at" TIMESTAMPTZ NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "metadata" JSONB,

    CONSTRAINT "subscription_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generations" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "user_id" UUID NOT NULL,
    "tool" "GenerationTool" NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'pending',
    "prompt" TEXT NOT NULL,
    "negative_prompt" TEXT,
    "model" VARCHAR(255),
    "result_urls" TEXT[],
    "error_message" TEXT,
    "tokens_used" INTEGER NOT NULL,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "metadata" JSONB,

    CONSTRAINT "generations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "content" TEXT NOT NULL,
    "model" VARCHAR(255),
    "tokens_used" INTEGER,
    "conversation_id" UUID,
    "metadata" JSONB,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "amount_rubles" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'RUB',
    "description" TEXT NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "invoice_id" VARCHAR(255),
    "subscription_tier" "SubscriptionTier",
    "confirmed_at" TIMESTAMPTZ,
    "failed_at" TIMESTAMPTZ,
    "failure_reason" TEXT,
    "metadata" JSONB,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_tier_config" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "tier" "SubscriptionTier" NOT NULL,
    "monthly_tokens" INTEGER NOT NULL,
    "price_rubles" INTEGER,
    "requests_per_minute" INTEGER NOT NULL,
    "burst_per_second" INTEGER NOT NULL,
    "requires_channel" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,

    CONSTRAINT "subscription_tier_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE INDEX "users_telegram_id_idx" ON "users"("telegram_id");

-- CreateIndex
CREATE INDEX "users_tier_idx" ON "users"("tier");

-- CreateIndex
CREATE INDEX "users_subscription_expires_at_idx" ON "users"("subscription_expires_at");

-- CreateIndex
CREATE INDEX "users_channel_subscribed_at_idx" ON "users"("channel_subscribed_at");

-- CreateIndex
CREATE INDEX "token_operations_user_id_idx" ON "token_operations"("user_id");

-- CreateIndex
CREATE INDEX "token_operations_created_at_idx" ON "token_operations"("created_at");

-- CreateIndex
CREATE INDEX "token_operations_operation_type_idx" ON "token_operations"("operation_type");

-- CreateIndex
CREATE INDEX "subscription_history_user_id_idx" ON "subscription_history"("user_id");

-- CreateIndex
CREATE INDEX "subscription_history_expires_at_idx" ON "subscription_history"("expires_at");

-- CreateIndex
CREATE INDEX "generations_user_id_idx" ON "generations"("user_id");

-- CreateIndex
CREATE INDEX "generations_tool_idx" ON "generations"("tool");

-- CreateIndex
CREATE INDEX "generations_status_idx" ON "generations"("status");

-- CreateIndex
CREATE INDEX "generations_created_at_idx" ON "generations"("created_at");

-- CreateIndex
CREATE INDEX "chat_messages_user_id_idx" ON "chat_messages"("user_id");

-- CreateIndex
CREATE INDEX "chat_messages_conversation_id_idx" ON "chat_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_external_id_key" ON "payments"("external_id");

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

-- CreateIndex
CREATE INDEX "payments_external_id_idx" ON "payments"("external_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_created_at_idx" ON "payments"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_tier_config_tier_key" ON "subscription_tier_config"("tier");

-- AddForeignKey
ALTER TABLE "token_operations" ADD CONSTRAINT "token_operations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generations" ADD CONSTRAINT "generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
