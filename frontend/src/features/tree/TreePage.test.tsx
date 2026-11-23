import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TopicNode } from './api';
import { TreePage } from './TreePage';

const node = (id: string, title: string, children: TopicNode[] = []): TopicNode => ({
  id,
  parentId: null,
  title,
  icon: null,
  color: null,
  position: 'a0',
  children,
});

function mockApi(tree: TopicNode[]) {
  const writes: { method: string; url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'GET') return new Response(JSON.stringify(tree));
      writes.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(JSON.stringify({}), { status: method === 'POST' ? 201 : 200 });
    }),
  );
  return writes;
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TreePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('TreePage', () => {
  it('mostra o estado vazio', async () => {
    mockApi([]);
    renderPage();
    expect(await screen.findByText('Nenhum tópico ainda. Crie o primeiro.')).toBeInTheDocument();
  });

  it('renderiza a hierarquia e recolhe subtópicos', async () => {
    mockApi([node('1', 'Música', [node('2', 'Violão')])]);
    renderPage();
    expect(await screen.findByText('Violão')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Recolher' }));
    expect(screen.queryByText('Violão')).not.toBeInTheDocument();
  });

  it('cria um tópico raiz', async () => {
    const writes = mockApi([]);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Novo tópico' }));
    await userEvent.type(screen.getByLabelText('Nome do tópico'), 'Estudos');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(writes[0]).toEqual({
      method: 'POST',
      url: '/api/v1/nodes',
      body: { title: 'Estudos', parentId: null },
    });
  });

  it('cria subtópico com o parentId do pai', async () => {
    const writes = mockApi([node('1', 'Música')]);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Novo subtópico: Música' }));
    await userEvent.type(screen.getByLabelText('Nome do tópico'), 'Teoria');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(writes[0]?.body).toEqual({ title: 'Teoria', parentId: '1' });
  });

  it('só apaga depois de confirmar', async () => {
    const writes = mockApi([node('1', 'Música')]);
    const confirm = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    renderPage();
    const del = await screen.findByRole('button', { name: 'Apagar: Música' });
    await userEvent.click(del);
    expect(writes).toHaveLength(0);
    await userEvent.click(del);
    expect(writes[0]).toMatchObject({ method: 'DELETE', url: '/api/v1/nodes/1' });
    confirm.mockRestore();
  });
});
