import type { Auth } from '../../auth.js';
import type { Database } from '../../db/client.js';
import { keyBetween } from '../nodes/fractional-index.js';
import { createNodeRepository } from '../nodes/repository.js';
import { extractText } from './extract-text.js';
import { createItemRepository, type ItemRow, type ItemSummaryRow } from './repository.js';

const EMPTY_DOC = { type: 'doc' as const, content: [] };

export class ItemError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

export class ItemService {
  private repo: ReturnType<typeof createItemRepository>;
  private nodes: ReturnType<typeof createNodeRepository>;

  constructor(
    db: Database,
    private auth: Auth,
  ) {
    this.repo = createItemRepository(db);
    this.nodes = createNodeRepository(db);
  }

  private async requireSession(headers: Headers) {
    const session = await this.auth.api.getSession({ headers });
    if (!session) throw new ItemError('unauthorized', 401);
    return session.user;
  }

  private async requireNode(nodeId: string, userId: string) {
    const target = await this.nodes.findById(nodeId, userId);
    if (!target) throw new ItemError('node_not_found', 404);
    return target;
  }

  async list(headers: Headers, nodeId: string) {
    const user = await this.requireSession(headers);
    await this.requireNode(nodeId, user.id);
    const rows = await this.repo.findByNode(user.id, nodeId);
    return rows.map((r) => this.toSummary(r));
  }

  async create(headers: Headers, nodeId: string, input: { title: string; type: 'note'; content?: ItemRow['content'] }) {
    const user = await this.requireSession(headers);
    const target = await this.requireNode(nodeId, user.id);
    if (target.archivedAt) throw new ItemError('node_archived', 409);

    const siblings = await this.repo.findByNode(user.id, nodeId);
    const position = keyBetween(siblings[siblings.length - 1]?.position ?? null, null);
    const content = input.content ?? EMPTY_DOC;

    const row = await this.repo.insert({
      userId: user.id,
      nodeId,
      type: input.type,
      title: input.title,
      content,
      contentText: extractText(content),
      position,
    });
    return this.toItem(row);
  }

  async get(headers: Headers, id: string) {
    const user = await this.requireSession(headers);
    const row = await this.repo.findById(id, user.id);
    if (!row) throw new ItemError('not_found', 404);
    return this.toItem(row);
  }

  async update(headers: Headers, id: string, input: { title?: string; content?: ItemRow['content'] }) {
    const user = await this.requireSession(headers);
    const row = await this.repo.update(id, user.id, {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.content !== undefined && { content: input.content, contentText: extractText(input.content) }),
    });
    if (!row) throw new ItemError('not_found', 404);
    return this.toItem(row);
  }

  async move(headers: Headers, id: string, input: { nodeId?: string; beforeId?: string | null; afterId?: string | null }) {
    const user = await this.requireSession(headers);
    const current = await this.repo.findById(id, user.id);
    if (!current) throw new ItemError('not_found', 404);

    const nodeId = input.nodeId ?? current.nodeId;
    const target = await this.requireNode(nodeId, user.id);
    if (nodeId !== current.nodeId && target.archivedAt) throw new ItemError('node_archived', 409);

    const siblings = (await this.repo.findByNode(user.id, nodeId)).filter((s) => s.id !== id);
    let beforePos: string | null = null;
    let afterPos: string | null = null;

    if (input.beforeId) {
      const before = siblings.find((s) => s.id === input.beforeId);
      if (!before) throw new ItemError('before_not_found', 404);
      afterPos = before.position;
      beforePos = siblings[siblings.indexOf(before) - 1]?.position ?? null;
    } else if (input.afterId) {
      const after = siblings.find((s) => s.id === input.afterId);
      if (!after) throw new ItemError('after_not_found', 404);
      beforePos = after.position;
      afterPos = siblings[siblings.indexOf(after) + 1]?.position ?? null;
    } else {
      beforePos = siblings[siblings.length - 1]?.position ?? null;
    }

    const row = await this.repo.update(id, user.id, { nodeId, position: keyBetween(beforePos, afterPos) });
    if (!row) throw new ItemError('not_found', 404);
    return this.toItem(row);
  }

  async delete(headers: Headers, id: string) {
    const user = await this.requireSession(headers);
    const row = await this.repo.softDelete(id, user.id);
    if (!row) throw new ItemError('not_found', 404);
    return { id: row.id, deletedAt: row.deletedAt };
  }

  private toSummary(row: ItemSummaryRow) {
    return {
      id: row.id,
      nodeId: row.nodeId,
      type: row.type,
      title: row.title,
      position: row.position,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toItem(row: ItemRow) {
    return { ...this.toSummary(row), content: row.content };
  }
}
