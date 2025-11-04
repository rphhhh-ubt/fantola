import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../services/auth.service';
import { LoginRequest, LoginResponse } from '../schemas/auth.schema';

export class AuthController {
  static async login(
    request: FastifyRequest<{ Body: LoginRequest }>,
    reply: FastifyReply
  ): Promise<LoginResponse> {
    const { telegramId, username } = request.body;
    const authService = new AuthService(request.server.db);

    const user = await authService.findOrCreateUser(telegramId, username);

    const token = await reply.jwtSign({
      userId: user.id,
      telegramId: user.telegramId,
      username: user.username,
      tier: user.tier,
    });

    return {
      token,
      user: {
        id: user.id,
        telegramId: parseInt(user.telegramId, 10),
        username: user.username,
        tier: user.tier,
      },
    };
  }

  static async getMe(request: FastifyRequest, reply: FastifyReply) {
    const payload = request.user as {
      userId: string;
      telegramId: number;
      username?: string;
      tier: string;
    };

    const authService = new AuthService(request.server.db);
    const user = await authService.getUserById(payload.userId);

    if (!user) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'User not found',
      });
    }

    return {
      id: user.id,
      telegramId: parseInt(user.telegramId, 10),
      username: user.username,
      tier: user.tier,
      tokensBalance: user.tokensBalance,
      tokensSpent: user.tokensSpent,
    };
  }
}
