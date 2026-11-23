import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { createAuth } from './auth.js';
import type { Env } from './config/env.js';
import type { Database } from './db/client.js';
import { authRoute } from './plugins/auth-route.js';
import { nodesRoutes } from './modules/nodes/routes.js';
import { NodeError } from './modules/nodes/service.js';
import { itemsRoutes } from './modules/items/routes.js';
import { ItemError } from './modules/items/service.js';
import { attachmentsRoutes } from './modules/attachments/routes.js';
import { AttachmentError } from './modules/attachments/service.js';
import { createS3Storage, type Storage } from './modules/attachments/storage.js';

export async function buildApp(env: Env, db: Database, deps: { storage?: Storage } = {}) {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: 'info' },
    // Acima do teto de conteúdo da nota (1 MB), que é validado pelo Zod com 400.
    bodyLimit: 2 * 1024 * 1024,
  });
  const auth = createAuth({ env, db });

  // Precisa vir ANTES do registro das rotas: plugins encapsulados herdam o handler vigente na criação.
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof NodeError || error instanceof ItemError || error instanceof AttachmentError) {
      return reply.status(error.status).send({ error: error.code });
    }
    // Erros do próprio Fastify/plugins com status 4xx (413, 429...) passam com o status original.
    const status = (error as { statusCode?: number }).statusCode;
    if (status !== undefined && status >= 400 && status < 500) {
      return reply.status(status).send({ error: (error as { code?: string }).code ?? 'bad_request' });
    }
    request.log.error(error);
    return reply.status(500).send({ error: 'internal_error' });
  });

  await app.register(helmet);
  await app.register(cors, { origin: env.FRONTEND_ORIGIN, credentials: true });
  await app.register(rateLimit, { global: true, max: env.NODE_ENV === 'test' ? 100_000 : 120, timeWindow: '1 minute' });

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(authRoute, { auth });
  await app.register(nodesRoutes, { db, auth });
  await app.register(itemsRoutes, { db, auth });
  await app.register(attachmentsRoutes, { db, auth, storage: deps.storage ?? createS3Storage(env) });

  // Rota protegida de exemplo; será o padrão de todo módulo.
  app.get('/api/v1/me', async (request, reply) => {
    const headers = new Headers();
    for (const [k, v] of Object.entries(request.headers)) if (typeof v === 'string') headers.set(k, v);
    const session = await auth.api.getSession({ headers });
    if (!session) return reply.status(401).send({ error: 'unauthorized' });
    return { id: session.user.id, email: session.user.email, name: session.user.name };
  });

  return { app, auth };
}
