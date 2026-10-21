import { QueryClient } from '@tanstack/react-query';

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown, public code?: string) { super(message); }
}

/** Canonical web API path: same-origin Clerk cookies, never bearer tokens. */
export async function apiRequest<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const multipart = body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    method, credentials: 'same-origin',
    headers: body && !multipart ? { 'Content-Type': 'application/json' } : {},
    body: body ? multipart ? body : JSON.stringify(body) : undefined,
  });
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new ApiError(502, 'O servidor não respondeu corretamente. Tente novamente em instantes.');
  }
  let data;
  try { data = await response.json(); }
  catch { throw new ApiError(502, 'O servidor retornou uma resposta inválida. Tente novamente em instantes.'); }
  if (data === null || typeof data !== 'object') {
    throw new ApiError(502, 'O servidor retornou uma resposta inválida. Tente novamente em instantes.');
  }
  if (!response.ok) throw new ApiError(response.status, data.message || 'Não foi possível concluir. Tente novamente.', data.details, data.code ?? data.error);
  return data;
}

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
