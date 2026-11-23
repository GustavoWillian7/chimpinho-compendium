import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

type Reply = { status?: number; body?: unknown };

function mockFetch(routes: Record<string, Reply[]>) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      const reply = routes[url]?.shift() ?? { status: 404, body: { error: 'not_found' } };
      const status = reply.status ?? 200;
      return new Response(reply.body === undefined ? '' : JSON.stringify(reply.body), { status });
    }),
  );
  return calls;
}

function renderLogin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>home</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('LoginPage', () => {
  it('mostra erro com senha incorreta', async () => {
    mockFetch({
      '/api/v1/me': [{ status: 401, body: { error: 'unauthorized' } }],
      '/api/auth/sign-in/email': [{ status: 401, body: { code: 'INVALID_EMAIL_OR_PASSWORD' } }],
    });
    renderLogin();
    await userEvent.type(await screen.findByLabelText('E-mail'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'errada');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
  });

  it('pede o código TOTP e entra depois de verificar', async () => {
    const calls = mockFetch({
      '/api/v1/me': [
        { status: 401, body: { error: 'unauthorized' } },
        { body: { id: '1', email: 'a@b.com', name: 'A' } },
      ],
      '/api/auth/sign-in/email': [{ body: { twoFactorRedirect: true } }],
      '/api/auth/two-factor/verify-totp': [{ body: { token: 'x' } }],
    });
    renderLogin();
    await userEvent.type(await screen.findByLabelText('E-mail'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-correta-123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await userEvent.type(await screen.findByLabelText('Código do autenticador'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verificar' }));

    await waitFor(() => expect(screen.getByText('home')).toBeInTheDocument());
    expect(calls).toContain('/api/auth/two-factor/verify-totp');
  });
});
