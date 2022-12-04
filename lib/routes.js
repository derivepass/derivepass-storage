import auth from './plugins/auth.js';
export default async (fastify) => {
    fastify.register(auth);
    // TODO(indutny): pagination, eventually
    fastify.get('/objects', async (request, reply) => {
        const objects = await fastify.db.getObjectsByOwner(request.user.username);
        return objects.map(({ id, data }) => ({ id, data }));
    });
    fastify.put('/objects/:id', async (request, reply) => {
        await fastify.db.saveObject({
            owner: request.user.username,
            id: request.params.id,
            data: JSON.stringify(request.body),
        });
        reply.status(201).send();
    });
};
