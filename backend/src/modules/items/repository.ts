import { and, asc, eq, inArray, isNull, like, or } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { item, node, type TiptapDoc } from '../../db/schema/index.js';

export type ItemRow = typeof item.$inferSelect;
export type ItemSummaryRow = Omit<ItemRow, 'content' | 'contentText'>;

export interface CreateItemInput {
  userId: string;
  nodeId: string;
  type: string;
  title: string;
  content: TiptapDoc;
  contentText: string;
  position: string;
}

export interface UpdateItemInput {
  title?: string;
  content?: TiptapDoc;
  contentText?: string;
  nodeId?: string;
  position?: string;
}

export function createItemRepository(db: Database) {
  async function findById(id: string, userId: string): Promise<ItemRow | undefined> {
    const [row] = await db
      .select()
      .from(item)
      .where(and(eq(item.id, id), eq(item.userId, userId), isNull(item.deletedAt)));
    return row;
  }

  /** Lista sem `content`/`contentText` para não trafegar documentos grandes. */
  async function findByNode(userId: string, nodeId: string): Promise<ItemSummaryRow[]> {
    return db
      .select({
        id: item.id,
        userId: item.userId,
        nodeId: item.nodeId,
        type: item.type,
        title: item.title,
        position: item.position,
        deletedAt: item.deletedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })
      .from(item)
      .where(and(eq(item.userId, userId), eq(item.nodeId, nodeId), isNull(item.deletedAt)))
      .orderBy(asc(item.position));
  }

  async function insert(input: CreateItemInput): Promise<ItemRow> {
    const [row] = await db.insert(item).values(input).returning();
    if (!row) throw new Error('Falha ao inserir item');
    return row;
  }

  async function update(id: string, userId: string, input: UpdateItemInput): Promise<ItemRow | undefined> {
    const [row] = await db
      .update(item)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(item.id, id), eq(item.userId, userId), isNull(item.deletedAt)))
      .returning();
    return row;
  }

  async function softDelete(id: string, userId: string): Promise<ItemRow | undefined> {
    const [row] = await db
      .update(item)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(item.id, id), eq(item.userId, userId), isNull(item.deletedAt)))
      .returning();
    return row;
  }

  /** Apaga (soft) os items de um node e de todos os seus descendentes. */
  async function softDeleteByNodeTree(userId: string, nodeId: string, nodePath: string): Promise<void> {
    const treeNodeIds = db
      .select({ id: node.id })
      .from(node)
      .where(and(eq(node.userId, userId), or(eq(node.id, nodeId), like(node.path, `${nodePath}/%`))));
    await db
      .update(item)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(item.userId, userId), isNull(item.deletedAt), inArray(item.nodeId, treeNodeIds)));
  }

  return { findById, findByNode, insert, update, softDelete, softDeleteByNodeTree };
}
