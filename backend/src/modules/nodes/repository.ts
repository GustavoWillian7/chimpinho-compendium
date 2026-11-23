import { eq, and, isNull, like, sql, asc } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { node } from '../../db/schema/index.js';

export interface NodeRow {
  id: string;
  userId: string;
  parentId: string | null;
  path: string;
  title: string;
  icon: string | null;
  color: string | null;
  position: string;
  archivedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNodeInput {
  userId: string;
  parentId: string | null;
  path: string;
  title: string;
  icon: string | null;
  color: string | null;
  position: string;
}

export interface UpdateNodeInput {
  title?: string;
  icon?: string | null;
  color?: string | null;
  path?: string;
  position?: string;
  archivedAt?: Date | null;
  deletedAt?: Date | null;
}

export function createNodeRepository(db: Database) {
  async function findById(id: string, userId: string): Promise<NodeRow | undefined> {
    const [row] = await db
      .select()
      .from(node)
      .where(and(eq(node.id, id), eq(node.userId, userId), isNull(node.deletedAt)));
    return row;
  }

  async function findChildren(userId: string, parentId: string | null): Promise<NodeRow[]> {
    const parentFilter = parentId === null ? isNull(node.parentId) : eq(node.parentId, parentId);
    return db
      .select()
      .from(node)
      .where(and(eq(node.userId, userId), parentFilter, isNull(node.deletedAt)))
      .orderBy(asc(node.position));
  }

  async function findDescendants(userId: string, pathPrefix: string): Promise<NodeRow[]> {
    return db
      .select()
      .from(node)
      .where(and(eq(node.userId, userId), like(node.path, `${pathPrefix}%`), isNull(node.deletedAt)))
      .orderBy(asc(node.path));
  }

  async function insert(input: CreateNodeInput): Promise<NodeRow> {
    const [row] = await db
      .insert(node)
      .values({
        userId: input.userId,
        parentId: input.parentId,
        path: input.path,
        title: input.title,
        icon: input.icon,
        color: input.color,
        position: input.position,
      })
      .returning();
    if (!row) throw new Error('Falha ao inserir node');
    return row;
  }

  async function update(id: string, userId: string, input: UpdateNodeInput): Promise<NodeRow | undefined> {
    const [row] = await db
      .update(node)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(node.id, id), eq(node.userId, userId)))
      .returning();
    return row;
  }

  async function moveAndRebuildPath(
    id: string,
    userId: string,
    newParentId: string | null,
    newPosition: string,
  ): Promise<NodeRow | undefined> {
    const target = await findById(id, userId);
    if (!target) return undefined;

    const oldPath = target.path;
    const newPath = newParentId === null ? id : `${(await findById(newParentId, userId))?.path ?? newParentId}/${id}`;

    await db.transaction(async (tx) => {
      await tx
        .update(node)
        .set({ parentId: newParentId, position: newPosition, path: newPath, updatedAt: new Date() })
        .where(and(eq(node.id, id), eq(node.userId, userId)));

      const descendants = await tx
        .select()
        .from(node)
        .where(and(eq(node.userId, userId), like(node.path, `${oldPath}/%`), isNull(node.deletedAt)));

      for (const desc of descendants) {
        const suffix = desc.path.slice(oldPath.length);
        await tx.update(node).set({ path: `${newPath}${suffix}`, updatedAt: new Date() }).where(eq(node.id, desc.id));
      }
    });

    return findById(id, userId);
  }

  async function softDelete(id: string, userId: string): Promise<NodeRow | undefined> {
    return update(id, userId, { deletedAt: new Date() });
  }

  async function softDeleteByPathPrefix(userId: string, pathPrefix: string): Promise<void> {
    await db
      .update(node)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(node.userId, userId), like(node.path, `${pathPrefix}/%`), isNull(node.deletedAt)));
  }

  async function countByUser(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(node)
      .where(and(eq(node.userId, userId), isNull(node.deletedAt)));
    return result?.count ?? 0;
  }

  return {
    findById,
    findChildren,
    findDescendants,
    insert,
    update,
    moveAndRebuildPath,
    softDelete,
    softDeleteByPathPrefix,
    countByUser,
  };
}

export type NodeRepository = ReturnType<typeof createNodeRepository>;
