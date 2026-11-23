import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { attachment, item } from '../../db/schema/index.js';

export type AttachmentRow = typeof attachment.$inferSelect;

export interface CreateAttachmentInput {
  id: string;
  userId: string;
  itemId: string;
  storageKey: string;
  filename: string;
  mime: string;
  sizeBytes: number;
}

export function createAttachmentRepository(db: Database) {
  // Toda leitura exige que o item dono não esteja apagado: anexos de item/node apagado somem sozinhos.
  const visible = (userId: string) =>
    and(eq(attachment.userId, userId), isNull(attachment.deletedAt), isNull(item.deletedAt));

  async function insert(input: CreateAttachmentInput): Promise<AttachmentRow> {
    const [row] = await db.insert(attachment).values(input).returning();
    if (!row) throw new Error('Falha ao inserir anexo');
    return row;
  }

  async function findById(id: string, userId: string): Promise<AttachmentRow | undefined> {
    const [row] = await db
      .select({ attachment })
      .from(attachment)
      .innerJoin(item, eq(item.id, attachment.itemId))
      .where(and(eq(attachment.id, id), visible(userId)));
    return row?.attachment;
  }

  async function findReadyByItem(userId: string, itemId: string): Promise<AttachmentRow[]> {
    const rows = await db
      .select({ attachment })
      .from(attachment)
      .innerJoin(item, eq(item.id, attachment.itemId))
      .where(and(eq(attachment.itemId, itemId), eq(attachment.status, 'ready'), visible(userId)))
      .orderBy(asc(attachment.createdAt));
    return rows.map((r) => r.attachment);
  }

  async function markReady(id: string, userId: string): Promise<AttachmentRow | undefined> {
    const [row] = await db
      .update(attachment)
      .set({ status: 'ready', updatedAt: new Date() })
      .where(and(eq(attachment.id, id), eq(attachment.userId, userId), isNull(attachment.deletedAt)))
      .returning();
    return row;
  }

  async function softDelete(id: string, userId: string): Promise<AttachmentRow | undefined> {
    const [row] = await db
      .update(attachment)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(attachment.id, id), eq(attachment.userId, userId), isNull(attachment.deletedAt)))
      .returning();
    return row;
  }

  return { insert, findById, findReadyByItem, markReady, softDelete };
}
