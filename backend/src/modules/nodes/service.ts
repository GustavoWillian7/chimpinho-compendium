import type { Auth } from '../../auth.js';
import type { Database } from '../../db/client.js';
import { keyBetween } from './fractional-index.js';
import { createItemRepository } from '../items/repository.js';
import { createNodeRepository, type NodeRow, type UpdateNodeInput } from './repository.js';

type NodeTree = ReturnType<NodeService['toNode']> & { children: NodeTree[] };

export class NodeService {
  private repo: ReturnType<typeof createNodeRepository>;

  constructor(
    private db: Database,
    private auth: Auth,
  ) {
    this.repo = createNodeRepository(db);
  }

  private async requireSession(headers: Headers) {
    const session = await this.auth.api.getSession({ headers });
    if (!session) throw new NodeError('unauthorized', 401);
    return session.user;
  }

  async create(headers: Headers, input: { title: string; parentId?: string | null; icon?: string; color?: string }) {
    const user = await this.requireSession(headers);
    const parentId = input.parentId ?? null;

    if (parentId) {
      const parent = await this.repo.findById(parentId, user.id);
      if (!parent) throw new NodeError('parent_not_found', 404);
    }

    const siblings = await this.repo.findChildren(user.id, parentId);
    const lastPosition = siblings[siblings.length - 1]?.position ?? null;
    const position = keyBetween(lastPosition, null);

    const row = await this.repo.insert({
      userId: user.id,
      parentId,
      path: '', // preenchido após obter o id
      title: input.title,
      icon: input.icon ?? null,
      color: input.color ?? null,
      position,
    });

    const path = parentId === null ? row.id : `${(await this.repo.findById(parentId, user.id))?.path ?? parentId}/${row.id}`;
    const updated = await this.repo.update(row.id, user.id, { path });
    if (!updated) throw new Error('Falha ao atualizar path do node');

    return this.toNode(updated);
  }

  async list(headers: Headers, opts?: { archived?: boolean }) {
    const user = await this.requireSession(headers);
    return this.buildTree(await this.repo.findChildren(user.id, null), user.id, opts?.archived ?? false);
  }

  private async buildTree(rows: NodeRow[], userId: string, archived: boolean): Promise<NodeTree[]> {
    const result = [];
    for (const row of rows) {
      if (!archived && row.archivedAt) continue;
      const children = await this.repo.findChildren(userId, row.id);
      result.push({
        ...this.toNode(row),
        children: await this.buildTree(children, userId, archived),
      });
    }
    return result;
  }

  async get(headers: Headers, id: string) {
    const user = await this.requireSession(headers);
    const row = await this.repo.findById(id, user.id);
    if (!row) throw new NodeError('not_found', 404);
    return this.toNode(row);
  }

  async update(headers: Headers, id: string, input: UpdateNodeInput) {
    const user = await this.requireSession(headers);
    const row = await this.repo.update(id, user.id, input);
    if (!row) throw new NodeError('not_found', 404);
    return this.toNode(row);
  }

  async move(
    headers: Headers,
    id: string,
    input: { parentId?: string | null; beforeId?: string | null; afterId?: string | null },
  ) {
    const user = await this.requireSession(headers);
    const target = await this.repo.findById(id, user.id);
    if (!target) throw new NodeError('not_found', 404);

    const parentId = input.parentId ?? target.parentId;
    if (parentId) {
      const parent = await this.repo.findById(parentId, user.id);
      if (!parent) throw new NodeError('parent_not_found', 404);
      // Impedir mover um node para dentro de seus próprios descendentes.
      if (parent.path.startsWith(`${target.path}/`)) throw new NodeError('invalid_move', 400);
    }

    const siblings = (await this.repo.findChildren(user.id, parentId)).filter((s) => s.id !== id);
    let beforePos: string | null = null;
    let afterPos: string | null = null;

    if (input.beforeId) {
      const before = siblings.find((s) => s.id === input.beforeId);
      if (!before) throw new NodeError('before_not_found', 404);
      afterPos = before.position;
      const prev = siblings[siblings.indexOf(before) - 1];
      beforePos = prev?.position ?? null;
    } else if (input.afterId) {
      const after = siblings.find((s) => s.id === input.afterId);
      if (!after) throw new NodeError('after_not_found', 404);
      beforePos = after.position;
      const next = siblings[siblings.indexOf(after) + 1];
      afterPos = next?.position ?? null;
    } else {
      const last = siblings[siblings.length - 1];
      beforePos = last?.position ?? null;
    }

    const position = keyBetween(beforePos, afterPos);
    const moved = await this.repo.moveAndRebuildPath(id, user.id, parentId, position);
    if (!moved) throw new NodeError('not_found', 404);
    return this.toNode(moved);
  }

  async delete(headers: Headers, id: string) {
    const user = await this.requireSession(headers);
    const row = await this.repo.findById(id, user.id);
    if (!row) throw new NodeError('not_found', 404);
    await this.db.transaction(async (tx) => {
      const txRepo = createNodeRepository(tx as unknown as Database);
      await txRepo.softDeleteByPathPrefix(user.id, row.path);
      await txRepo.softDelete(id, user.id);
      await createItemRepository(tx as unknown as Database).softDeleteByNodeTree(user.id, id, row.path);
    });
    return { id: row.id, deletedAt: new Date() };
  }

  async archive(headers: Headers, id: string, archived: boolean) {
    const user = await this.requireSession(headers);
    const row = await this.repo.update(id, user.id, { archivedAt: archived ? new Date() : null });
    if (!row) throw new NodeError('not_found', 404);
    return this.toNode(row);
  }

  private toNode(row: NonNullable<Awaited<ReturnType<typeof this.repo.findById>>>) {
    return {
      id: row.id,
      parentId: row.parentId,
      path: row.path,
      title: row.title,
      icon: row.icon,
      color: row.color,
      position: row.position,
      archivedAt: row.archivedAt,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export class NodeError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
