import { PrismaClient, User } from '@monorepo/database';

export class AuthService {
  constructor(private db: PrismaClient) {}

  async findOrCreateUser(telegramId: number, username?: string): Promise<User> {
    const telegramIdStr = telegramId.toString();
    let user = await this.db.user.findUnique({
      where: { telegramId: telegramIdStr },
    });

    if (!user) {
      user = await this.db.user.create({
        data: {
          telegramId: telegramIdStr,
          username: username || null,
          tier: 'Gift',
          tokensBalance: 100,
        },
      });
    }

    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.db.user.findUnique({
      where: { id },
    });
  }
}
