import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Auth } from '../../auth.js';
import type { Database } from '../../db/client.js';
import { searchQuerySchema } from './schemas.js';
import { SearchError, SearchService } from './service.js';

function makeHeaders(request: FastifyRequest) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(request.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((item) => headers.append(k, item));
    else headers.set(k, v);
  }
  return headers;
}

export async function searchRoutes(app: FastifyInstance, opts: { db: Database; auth: Auth }) {
  const service = new SearchService(opts.db, opts.auth);

  app.get('/api/v1/search', async (request) => {
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new SearchError(`invalid_input: ${issues}`, 400);
    }
    return service.search(makeHeaders(request), parsed.data);
  });
}
