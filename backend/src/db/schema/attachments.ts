import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.js';
import { item } from './items.js';

export const attachment = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id')
      .notNull()
      .references(() => item.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull().unique(),
    filename: text('filename').notNull(),
    mime: text('mime').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    status: text('status').notNull().default('pending'),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('attachments_status_check', sql`${t.status} in ('pending', 'ready')`),
    check('attachments_size_check', sql`${t.sizeBytes} > 0`),
    index('attachments_user_id_idx').on(t.userId),
    index('attachments_item_id_idx').on(t.itemId),
  ],
);
