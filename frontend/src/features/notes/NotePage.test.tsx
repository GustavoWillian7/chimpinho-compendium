import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Note } from './api';
import { NotePage } from './NotePage';

const note: Note = {
  id: 'n1',
  nodeId: 't1',
  type: 'note',
  title: 'Escalas',
  position: 'V',
  createdAt: '2026-11-23T00:00:00Z',
  updatedAt: '2026-11-23T00:00:00Z',
  content: {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Dó maior' }] }],
  },
};

function mockApi() {
  const writes: { method: string; url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'GET') return new Response(JSON.stringify(note));
      writes.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : {} });
      return new Response(JSON.stringify(note));
    }),
  );
  return writes;
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/notes/n1']}>
        <Routes>
          <Route path="/notes/:id" element={<NotePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('NotePage', () => {
  it('carrega título e conteúdo da nota', async () => {
    mockApi();
    renderPage();
    expect(await screen.findByDisplayValue('Escalas')).toBeInTheDocument();
    expect(await screen.findByText('Dó maior')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Salvo');
  });

  it('salva o título sozinho depois de editar', async () => {
    const writes = mockApi();
    renderPage();
    const input = await screen.findByLabelText('Título da nota');
    await userEvent.type(input, ' maiores');
    expect(screen.getByRole('status')).toHaveTextContent('Alterações não salvas');
    await waitFor(() => expect(writes).toHaveLength(1), { timeout: 3000 });
    expect(writes[0]).toMatchObject({
      method: 'PATCH',
      url: '/api/v1/items/n1',
      body: { title: 'Escalas maiores' },
    });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Salvo'));
  });

  it('não envia título vazio', async () => {
    const writes = mockApi();
    renderPage();
    const input = await screen.findByLabelText('Título da nota');
    await userEvent.clear(input);
    await new Promise((r) => setTimeout(r, 1200));
    expect(writes).toHaveLength(0);
  });
});
