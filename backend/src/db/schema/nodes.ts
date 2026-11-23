import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth.js';

export const node = pgTable(
  'nodes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    path: text('path').notNull(),
    title: text('title').notNull(),
    icon: text('icon'),
    color: text('color'),
    position: text('position').notNull().default('0'),
    archivedAt: timestamp('archived_at'),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('nodes_user_id_idx').on(t.userId),
    index('nodes_parent_id_idx').on(t.parentId),
    index('nodes_path_idx').on(t.path),
    index('nodes_position_idx').on(t.userId, t.parentId, t.position),
  ],
);
