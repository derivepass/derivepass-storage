import type { FastifyInstance } from 'fastify';
import FastifyPlugin from 'fastify-plugin';

import { checkPasswordHash, checkAuthToken } from '../crypto.js';
import { type User, type AuthToken } from '../db.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: User;
  }
}

export function encodeAuthToken({ id, token }: AuthToken): string {
  return `${id}:${token.toString('base64')}`;
}

async function auth(fastify: FastifyInstance): Promise<void> {
  fastify.addHook<{
    Headers: { authorization: 'string' };
  }>('onRequest', async (request, reply) => {
    const { authorization } = request.headers;
    fastify.assert(
      authorization,
      401,
      'Missing Authorization header',
    );

    const [type, data] = authorization.split(/\s+/g, 2);

    let isValid = false;
    let user: User | undefined;

    try {
      if (type.toLowerCase() === 'basic') {
        const [username, password] =
          Buffer.from(data, 'base64').toString().split(':', 2);

        user = await fastify.db.getUser(username);
        if (!user) {
          return reply.forbidden('Incorrect password');
        }

        isValid = await checkPasswordHash(user, password);
      } else if (type.toLowerCase() === 'bearer') {
        const [tokenId, tokenData] = data.split(':', 2);
        const token = await fastify.db.getAuthToken(
          Buffer.from(tokenId, 'base64'),
        );
        if (!token) {
          return reply.forbidden('Incorrect token');
        }

        user = await fastify.db.getUser(token.owner);
        if (!user) {
          return reply.forbidden('Incorrect password');
        }

        isValid = await checkAuthToken(token, Buffer.from(tokenData, 'base64'));
      } else {
        fastify.assert(400, 'Invalid authorization type');
        return;
      }
    } catch (error) {
      return reply.badRequest('Bad input');
    }

    if (!isValid) {
      return reply.forbidden('Incorrect password');
    }

    request.user = user;
    if (!request.user) {
      return reply.forbidden('Incorrect password');
    }

    return undefined;
  });
}

export default FastifyPlugin(auth);
