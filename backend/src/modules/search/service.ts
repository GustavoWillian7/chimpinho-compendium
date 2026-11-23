import type { Auth } from '../../auth.js';
import type { Database } from '../../db/client.js';
import { createSearchRepository } from './repository.js';

export class SearchError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

export class SearchService {
  private repo: ReturnType<typeof createSearchRepository>;

  constructor(
    db: Database,
    private auth: Auth,
  ) {
    this.repo = createSearchRepository(db);
  }

  async search(headers: Headers, input: { q: string; limit: number }) {
    const session = await this.auth.api.getSession({ headers });
    if (!session) throw new SearchError('unauthorized', 401);
    return this.repo.searchItems(session.user.id, input.q, input.limit);
  }
}
