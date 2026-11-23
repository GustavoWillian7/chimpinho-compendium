import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeAny } from 'zod';
import type { Auth } from '../../auth.js';
import type { Database } from '../../db/client.js';
import { NodeError, NodeService } from './service.js';
import { archiveNodeSchema, createNodeSchema, moveNodeSchema, nodeParamsSchema, updateNodeSchema } from './schemas.js';

function makeHeaders(request: FastifyRequest) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(request.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((item) => headers.append(k, item));
    else headers.set(k, v);
  }
  return headers;
}

function parseBody<T extends ZodTypeAny>(schema: T, body: unknown) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new NodeError(`invalid_input: ${issues}`, 400);
  }
  return parsed.data;
}

function ok201(reply: FastifyReply, data: unknown) {
  reply.status(201);
  return data;
}

export async function nodesRoutes(app: FastifyInstance, opts: { db: Database; auth: Auth }) {
  const service = new NodeService(opts.db, opts.auth);

  app.get('/api/v1/nodes', async (request, reply) => {
    const headers = makeHeaders(request);
    const archived = (request.query as Record<string, string> | undefined)?.archived === 'true';
    return service.list(headers, { archived });
  });

  app.post('/api/v1/nodes', async (request, reply) => {
    const headers = makeHeaders(request);
    const body = parseBody(createNodeSchema, request.body);
    return ok201(reply, await service.create(headers, body));
  });

  app.get('/api/v1/nodes/:id', async (request, reply) => {
    const headers = makeHeaders(request);
    const { id } = parseBody(nodeParamsSchema, request.params);
    return service.get(headers, id);
  });

  app.patch('/api/v1/nodes/:id', async (request, reply) => {
    const headers = makeHeaders(request);
    const { id } = parseBody(nodeParamsSchema, request.params);
    const body = parseBody(updateNodeSchema, request.body);
    return service.update(headers, id, body);
  });

  app.delete('/api/v1/nodes/:id', async (request, reply) => {
    const headers = makeHeaders(request);
    const { id } = parseBody(nodeParamsSchema, request.params);
    return service.delete(headers, id);
  });

  app.post('/api/v1/nodes/:id/move', async (request, reply) => {
    const headers = makeHeaders(request);
    const { id } = parseBody(nodeParamsSchema, request.params);
    const body = parseBody(moveNodeSchema, request.body);
    return service.move(headers, id, body);
  });

  app.post('/api/v1/nodes/:id/archive', async (request, reply) => {
    const headers = makeHeaders(request);
    const { id } = parseBody(nodeParamsSchema, request.params);
    const { archived } = parseBody(archiveNodeSchema, request.body);
    return service.archive(headers, id, archived);
  });
}
