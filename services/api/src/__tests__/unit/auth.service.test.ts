import { AuthService } from '../../services/auth.service';
import { PrismaClient } from '@monorepo/database';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
} as unknown as PrismaClient;

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('findOrCreateUser', () => {
    it('should return existing user if found', async () => {
      const existingUser = {
        id: 'uuid-1',
        telegramId: '123456789',
        username: 'testuser',
        tier: 'Gift',
        tokensBalance: 100,
        tokensSpent: 0,
        subscriptionExpiresAt: null,
        channelSubscribedAt: null,
        firstName: null,
        lastName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);

      const result = await authService.findOrCreateUser(123456789, 'testuser');

      expect(result).toEqual(existingUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: '123456789' },
      });
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should create new user if not found', async () => {
      const newUser = {
        id: 'uuid-2',
        telegramId: '987654321',
        username: 'newuser',
        tier: 'Gift',
        tokensBalance: 100,
        tokensSpent: 0,
        subscriptionExpiresAt: null,
        channelSubscribedAt: null,
        firstName: null,
        lastName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.user.create as jest.Mock).mockResolvedValue(newUser);

      const result = await authService.findOrCreateUser(987654321, 'newuser');

      expect(result).toEqual(newUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: '987654321' },
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          telegramId: '987654321',
          username: 'newuser',
          tier: 'Gift',
          tokensBalance: 100,
        },
      });
    });

    it('should create user with null username if not provided', async () => {
      const newUser = {
        id: 'uuid-3',
        telegramId: '111111111',
        username: null,
        tier: 'Gift',
        tokensBalance: 100,
        tokensSpent: 0,
        subscriptionExpiresAt: null,
        channelSubscribedAt: null,
        firstName: null,
        lastName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.user.create as jest.Mock).mockResolvedValue(newUser);

      const result = await authService.findOrCreateUser(111111111);

      expect(result).toEqual(newUser);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          telegramId: '111111111',
          username: null,
          tier: 'Gift',
          tokensBalance: 100,
        },
      });
    });
  });

  describe('getUserById', () => {
    it('should return user if found', async () => {
      const user = {
        id: 'uuid-1',
        telegramId: '123456789',
        username: 'testuser',
        tier: 'Gift',
        tokensBalance: 100,
        tokensSpent: 0,
        subscriptionExpiresAt: null,
        channelSubscribedAt: null,
        firstName: null,
        lastName: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const result = await authService.getUserById('uuid-1');

      expect(result).toEqual(user);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
      });
    });

    it('should return null if user not found', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await authService.getUserById('uuid-999');

      expect(result).toBeNull();
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'uuid-999' },
      });
    });
  });
});
