import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { item, node } from '../../db/schema/index.js';

/** Marcadores de destaque do snippet: caracteres de controle, nunca HTML. */
export const HIGHLIGHT_START = '\u0001';
export const HIGHLIGHT_END = '\u0002';
const HEADLINE_OPTIONS = `StartSel=${HIGHLIGHT_START}, StopSel=${HIGHLIGHT_END}, MaxFragments=1, MaxWords=20, MinWords=8`;

/** Escapa `\`, `%` e `_` para uso literal em LIKE/ILIKE (com `ESCAPE '\'`). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function createSearchRepository(db: Database) {
  async function searchItems(userId: string, q: string, limit: number) {
    // websearch_to_tsquery aceita texto livre sem erro de sintaxe; o valor vai sempre como parâmetro.
    const tsQuery = sql`websearch_to_tsquery('portuguese', ${q})`;
    const titleLike = `%${escapeLike(q)}%`;
    const rank = sql<number>`ts_rank(${item.searchVector}, ${tsQuery})`;

    return db
      .select({
        id: item.id,
        nodeId: item.nodeId,
        nodeTitle: node.title,
        nodeArchived: sql<boolean>`(${node.archivedAt} is not null)`,
        type: item.type,
        title: item.title,
        snippet: sql<string>`ts_headline('portuguese', ${item.contentText}, ${tsQuery}, ${HEADLINE_OPTIONS})`,
        updatedAt: item.updatedAt,
      })
      .from(item)
      .innerJoin(node, eq(node.id, item.nodeId))
      .where(
        and(
          eq(item.userId, userId),
          eq(node.userId, userId),
          isNull(item.deletedAt),
          isNull(node.deletedAt),
          or(sql`${item.searchVector} @@ ${tsQuery}`, sql`${item.title} ilike ${titleLike} escape '\\'`),
        ),
      )
      .orderBy(desc(rank), desc(item.updatedAt))
      .limit(limit);
  }

  return { searchItems };
}
