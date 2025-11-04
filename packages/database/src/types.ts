import { Prisma } from '@prisma/client';

// User with all relations
export type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    tokenOperations: true;
    subscriptionHistory: true;
    generations: true;
    chatMessages: true;
    payments: true;
  };
}>;

// Token operation with user
export type TokenOperationWithUser = Prisma.TokenOperationGetPayload<{
  include: {
    user: true;
  };
}>;

// Generation with user
export type GenerationWithUser = Prisma.GenerationGetPayload<{
  include: {
    user: true;
  };
}>;

// Payment with user
export type PaymentWithUser = Prisma.PaymentGetPayload<{
  include: {
    user: true;
  };
}>;

// Chat message with user
export type ChatMessageWithUser = Prisma.ChatMessageGetPayload<{
  include: {
    user: true;
  };
}>;
