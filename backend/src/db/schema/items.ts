import { check, customType, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './auth.js';
import { node } from './nodes.js';

export interface TiptapDoc {
  type: 'doc';
  content?: unknown[];
  [key: string]: unknown;
}

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

export const item = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    nodeId: uuid('node_id')
      .notNull()
      .references(() => node.id, { onDelete: 'cascade' }),
    type: text('type').notNull().default('note'),
    title: text('title').notNull(),
    content: jsonb('content').$type<TiptapDoc>().notNull().default({ type: 'doc', content: [] }),
    contentText: text('content_text').notNull().default(''),
    position: text('position').notNull().default('0'),
    // Mantida pelo Postgres: título (peso A) + texto extraído (peso B). Nunca gravar.
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('portuguese', "title"), 'A') || setweight(to_tsvector('portuguese', "content_text"), 'B')`,
    ),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    check('items_type_check', sql`${t.type} in ('note')`),
    index('items_user_id_idx').on(t.userId),
    index('items_node_id_idx').on(t.nodeId),
    index('items_position_idx').on(t.userId, t.nodeId, t.position),
    index('items_search_idx').using('gin', t.searchVector),
  ],
);
