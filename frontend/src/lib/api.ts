export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

// Content-Type só quando há corpo: o Fastify rejeita JSON vazio.
export async function api<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const obj = (data ?? {}) as { error?: string; code?: string; message?: string };
    throw new ApiError(res.status, obj.error ?? obj.code ?? obj.message ?? 'unknown_error');
  }
  return data as T;
}
