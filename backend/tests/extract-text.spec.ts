import { describe, expect, it } from 'vitest';
import { extractText } from '../src/modules/items/extract-text.js';

describe('extractText', () => {
  it('retorna string vazia para documento vazio', () => {
    expect(extractText({ type: 'doc', content: [] })).toBe('');
    expect(extractText(null)).toBe('');
  });

  it('junta texto de parágrafos separando por quebra de linha', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Título' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Olá ' }, { type: 'text', text: 'mundo', marks: [{ type: 'bold' }] }] },
      ],
    };
    expect(extractText(doc)).toBe('Título\nOlá mundo');
  });

  it('percorre listas aninhadas', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'um' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'dois' }] }] },
          ],
        },
      ],
    };
    expect(extractText(doc)).toBe('um\ndois');
  });
});
