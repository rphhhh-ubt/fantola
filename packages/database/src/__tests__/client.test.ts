import { createPrismaClient, disconnectPrisma } from '../client';

describe('Prisma Client', () => {
  afterEach(async () => {
    await disconnectPrisma();
  });

  it('should create a Prisma client instance', () => {
    const client = createPrismaClient();
    expect(client).toBeDefined();
    expect(client.$connect).toBeDefined();
    expect(client.$disconnect).toBeDefined();
  });

  it('should return the same instance on multiple calls', () => {
    const client1 = createPrismaClient();
    const client2 = createPrismaClient();
    expect(client1).toBe(client2);
  });
});
