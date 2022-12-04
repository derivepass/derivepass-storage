import type { FastifyInstance } from 'fastify';
import FastifyPlugin from 'fastify-plugin';

import { checkPasswordHash } from '../crypto.js';
import { type User } from '../db.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: User;
  }
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

    const [basic, base64] = authorization.split(/\s+/g, 2);
    fastify.assert(
      basic.toLowerCase() === 'basic',
      400,
      'Invalid Authorization header',
    );

    let isValid = false;
    let user: User | undefined;
    try {
      const [username, password] =
        Buffer.from(base64, 'base64').toString().split(':', 2);

      user = await fastify.db.getUser(username);
      if (!user) {
        return reply.forbidden('Incorrect password');
      }

      isValid = await checkPasswordHash(user, password);
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
