const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'listItem',
  'taskItem',
  'bulletList',
  'orderedList',
  'taskList',
  'horizontalRule',
  'hardBreak',
  'tableRow',
  'tableCell',
  'tableHeader',
]);

/** Extrai o texto puro de um documento Tiptap/ProseMirror (para busca). */
export function extractText(doc: unknown): string {
  const parts: string[] = [];

  const walk = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const node = n as { type?: unknown; text?: unknown; content?: unknown };
    if (typeof node.text === 'string') parts.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(walk);
    if (typeof node.type === 'string' && BLOCK_TYPES.has(node.type)) parts.push('\n');
  };

  walk(doc);
  return parts
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}
