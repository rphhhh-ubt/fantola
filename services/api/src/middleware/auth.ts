import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
) {
  try {
    await request.jwtVerify();
    done();
  } catch (err) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token',
    });
  }
}

export function requireAuth() {
  return authMiddleware;
}
