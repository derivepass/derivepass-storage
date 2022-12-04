import Fastify from 'fastify';
import FastifySensible from '@fastify/sensible';
import FastifyRateLimit from '@fastify/rate-limit';
import FastifyCORS from '@fastify/cors';

import { Database } from './lib/db.js';
import { HOUR } from './lib/constants.js';
import routes from './lib/routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
  }
}

const fastify = Fastify({
  logger: {
    transport: { target: '@fastify/one-line-logger' },
  },
});

const db = new Database();

setInterval(async () => {
  try {
    await db.deleteStaleAuthTokens();
  } catch (error) {
    console.error('Failed to delete stale auth tokens', error);
  }
}, HOUR);

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

fastify
  .decorate('db', db);

fastify.register(FastifySensible);
fastify.register(FastifyRateLimit, {
  async keyGenerator(request) {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      return String(forwardedFor);
    }

    return request.ip;
  }
});
fastify.register(FastifyCORS);
fastify.register(routes);

await fastify.listen({ port: 8000, host: '127.0.0.1' });
