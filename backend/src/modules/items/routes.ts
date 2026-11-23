import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { z, ZodTypeAny } from 'zod';
import type { Auth } from '../../auth.js';
import type { Database } from '../../db/client.js';
import { ItemError, ItemService } from './service.js';
import {
  createItemSchema,
  itemParamsSchema,
  moveItemSchema,
  nodeItemsParamsSchema,
  updateItemSchema,
} from './schemas.js';

function makeHeaders(request: FastifyRequest) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(request.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((item) => headers.append(k, item));
    else headers.set(k, v);
  }
  return headers;
}

function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.output<T> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new ItemError(`invalid_input: ${issues}`, 400);
  }
  return parsed.data;
}

function created(reply: FastifyReply, data: unknown) {
  reply.status(201);
  return data;
}

export async function itemsRoutes(app: FastifyInstance, opts: { db: Database; auth: Auth }) {
  const service = new ItemService(opts.db, opts.auth);

  app.get('/api/v1/nodes/:nodeId/items', async (request) => {
    const { nodeId } = parse(nodeItemsParamsSchema, request.params);
    return service.list(makeHeaders(request), nodeId);
  });

  app.post('/api/v1/nodes/:nodeId/items', async (request, reply) => {
    const { nodeId } = parse(nodeItemsParamsSchema, request.params);
    const body = parse(createItemSchema, request.body);
    return created(reply, await service.create(makeHeaders(request), nodeId, body));
  });

  app.get('/api/v1/items/:id', async (request) => {
    const { id } = parse(itemParamsSchema, request.params);
    return service.get(makeHeaders(request), id);
  });

  app.patch('/api/v1/items/:id', async (request) => {
    const { id } = parse(itemParamsSchema, request.params);
    const body = parse(updateItemSchema, request.body);
    return service.update(makeHeaders(request), id, body);
  });

  app.delete('/api/v1/items/:id', async (request) => {
    const { id } = parse(itemParamsSchema, request.params);
    return service.delete(makeHeaders(request), id);
  });

  app.post('/api/v1/items/:id/move', async (request) => {
    const { id } = parse(itemParamsSchema, request.params);
    const body = parse(moveItemSchema, request.body);
    return service.move(makeHeaders(request), id, body);
  });
}
