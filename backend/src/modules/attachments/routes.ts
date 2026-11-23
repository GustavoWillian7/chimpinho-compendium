import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { z, ZodTypeAny } from 'zod';
import type { Auth } from '../../auth.js';
import type { Database } from '../../db/client.js';
import { attachmentParamsSchema, createAttachmentSchema, itemAttachmentsParamsSchema } from './schemas.js';
import { AttachmentError, AttachmentService } from './service.js';
import type { Storage } from './storage.js';

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
    throw new AttachmentError(`invalid_input: ${issues}`, 400);
  }
  return parsed.data;
}

function created(reply: FastifyReply, data: unknown) {
  reply.status(201);
  return data;
}

export async function attachmentsRoutes(
  app: FastifyInstance,
  opts: { db: Database; auth: Auth; storage: Storage | undefined },
) {
  const service = new AttachmentService(opts.db, opts.auth, opts.storage);

  app.post('/api/v1/items/:itemId/attachments', async (request, reply) => {
    const { itemId } = parse(itemAttachmentsParamsSchema, request.params);
    const body = parse(createAttachmentSchema, request.body);
    return created(reply, await service.create(makeHeaders(request), itemId, body));
  });

  app.get('/api/v1/items/:itemId/attachments', async (request) => {
    const { itemId } = parse(itemAttachmentsParamsSchema, request.params);
    return service.list(makeHeaders(request), itemId);
  });

  app.post('/api/v1/attachments/:id/complete', async (request) => {
    const { id } = parse(attachmentParamsSchema, request.params);
    return service.complete(makeHeaders(request), id);
  });

  app.get('/api/v1/attachments/:id/download', async (request) => {
    const { id } = parse(attachmentParamsSchema, request.params);
    return service.download(makeHeaders(request), id);
  });

  app.delete('/api/v1/attachments/:id', async (request) => {
    const { id } = parse(attachmentParamsSchema, request.params);
    return service.delete(makeHeaders(request), id);
  });
}
