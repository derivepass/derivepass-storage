import type { FastifyInstance } from 'fastify';
import FastifyCORS from '@fastify/cors';

import { createAuthToken } from './crypto.js';
import auth, { encodeAuthToken } from './plugins/auth.js';

export default async (fastify: FastifyInstance): Promise<void> => {
  fastify.register(FastifyCORS, {
    origin: true,
  });
  fastify.register(auth);

  fastify.put('/user/token', async (request, reply) => {
    const token = createAuthToken(request.user);
    await fastify.db.saveAuthToken(token);

    reply.status(200).send(encodeAuthToken(token));
  });

  fastify.delete<{
    Body: { id: string }
  }>('/user/token', async (request, reply) => {
    await fastify.db.deleteAuthToken(
      request.user,
      Buffer.from(request.body.id, 'base64'),
    );

    reply.status(202).send();
  });

  // TODO(indutny): pagination, eventually
  fastify.get('/objects', async (request) => {
    const objects = await fastify.db.getObjectsByOwner(request.user.username);

    return objects.map(({ id, data }) => ({ id, data }));
  });

  fastify.put<{
    Params: { id: string }
    Body: unknown;
  }>('/objects/:id', async (request, reply) => {
    await fastify.db.saveObject({
      owner: request.user.username,
      id: request.params.id,
      data: JSON.stringify(request.body),
    });

    reply.status(201).send();
  });
};
