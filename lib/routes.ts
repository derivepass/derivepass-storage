import type { FastifyInstance } from 'fastify';
import FastifyCORS from '@fastify/cors';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';

import { createAuthToken } from './crypto.js';
import auth, { encodeAuthToken, decodeAuthToken } from './plugins/auth.js';

export default async (fastify: FastifyInstance): Promise<void> => {
  const typed = fastify.withTypeProvider<TypeBoxTypeProvider>();

  typed.register(FastifyCORS, {
    origin: true,
  });
  typed.register(auth);

  typed.put('/user/token', {
    schema: {
      response: {
        200: Type.Object({ token: Type.String() }),
      },
    },
  }, async (request, reply) => {
    if (request.token) {
      reply.status(403).send();
    }

    const token = createAuthToken(request.user);
    await typed.db.saveAuthToken(token);

    reply.status(200).send({ token: encodeAuthToken(token) });
  });

  typed.delete('/user/token', {
    schema: {
      body: Type.Object({ token: Type.String() }),
    },
  }, async (request, reply) => {
    const token = decodeAuthToken(request.body.token);

    await typed.db.deleteAuthToken(request.user, token.id);

    reply.status(202).send();
  });

  // TODO(indutny): pagination, eventually
  typed.get('/objects', {
    schema: {
      querystring: Type.Object({ since: Type.Optional(Type.Number()) }),
      response: {
        200: Type.Object({
          objects: Type.Array(Type.Object({
            id: Type.String(),
            data: Type.String(),
            modifiedAt: Type.Number(),
          })),
        }),
      },
    },
  }, async (request) => {
    const objects = await typed.db.getObjectsByOwner({
      owner: request.user,
      since: request.query.since ?? 0,
    });

    return { objects };
  });

  typed.put('/objects', {
    schema: {
      body: Type.Object({
        objects: Type.Array(
          Type.Object({
            id: Type.String(),
            data: Type.Record(Type.String(), Type.Unknown()),
          })
        )
      }),
      response: {
        201: Type.Object({ modifiedAt: Type.Number() }),
      },
    },
  }, async (request, reply) => {
    const { objects } = request.body;
    const modifiedAt =
      await typed.db.saveObjects(request.user, objects.map(x => {
        return {
          ...x,
          data: JSON.stringify(x.data),
        };
      }));

    reply.status(201).send({
      modifiedAt,
    });
  });
};
