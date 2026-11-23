// O backend marca os termos achados com \u0001 (abre) e \u0002 (fecha), nunca HTML.
export type SnippetPart = { text: string; match: boolean };

export function parseSnippet(snippet: string): SnippetPart[] {
  const parts: SnippetPart[] = [];
  let match = false;
  let text = '';
  const flush = () => {
    if (text) parts.push({ text, match });
    text = '';
  };
  for (const ch of snippet) {
    if (ch === '\u0001' || ch === '\u0002') {
      flush();
      match = ch === '\u0001';
    } else {
      text += ch;
    }
  }
  flush();
  return parts;
}
