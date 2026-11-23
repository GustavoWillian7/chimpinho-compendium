import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchPage } from './SearchPage';
import { parseSnippet } from './snippet';

const hit = {
  id: 'n1',
  nodeId: 't1',
  nodeTitle: 'Música',
  nodeArchived: true,
  type: 'note',
  title: 'Escalas',
  snippet: 'a escala \u0001maior\u0002 tem sete notas <b>x</b>',
  updatedAt: '2026-11-23T00:00:00Z',
};

function mockApi(results: unknown[]) {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify(results));
    }),
  );
  return urls;
}

function renderPage(entry = '/search') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[entry]}>
        <SearchPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('parseSnippet', () => {
  it('separa trechos marcados pelos caracteres de controle', () => {
    expect(parseSnippet('a \u0001b\u0002 c')).toEqual([
      { text: 'a ', match: false },
      { text: 'b', match: true },
      { text: ' c', match: false },
    ]);
  });
});

describe('SearchPage', () => {
  it('não consulta com o campo vazio', () => {
    const urls = mockApi([]);
    renderPage();
    expect(urls).toHaveLength(0);
  });

  it('busca, destaca o termo e mostra HTML como texto', async () => {
    const urls = mockApi([hit]);
    renderPage();
    await userEvent.type(screen.getByLabelText('Buscar nas notas'), 'maior');
    const link = await screen.findByRole('link', { name: /Escalas/ });
    expect(link).toHaveAttribute('href', '/notes/n1');
    expect(link).toHaveTextContent('Música · arquivado');
    expect(screen.getByText('maior').tagName).toBe('MARK');
    expect(link).toHaveTextContent('<b>x</b>');
    expect(urls.at(-1)).toBe('/api/v1/search?q=maior');
  });

  it('mostra mensagem quando nada é encontrado', async () => {
    mockApi([]);
    renderPage('/search?q=zzz');
    expect(await screen.findByText('Nada encontrado.')).toBeInTheDocument();
  });
});
