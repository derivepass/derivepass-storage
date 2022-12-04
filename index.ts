import Fastify from 'fastify';
import FastifySensible from '@fastify/sensible';
import FastifyRateLimit from '@fastify/rate-limit';
import FastifyCORS from '@fastify/cors';

import { Database } from './lib/db.js';
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

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

fastify
  .decorate('db', db);

fastify.register(FastifySensible);
fastify.register(FastifyRateLimit);
fastify.register(FastifyCORS);
fastify.register(routes);

await fastify.listen({ port: 8000, host: '127.0.0.1' });
