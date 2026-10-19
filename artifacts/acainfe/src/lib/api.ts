export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}
export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const multipart = body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    method, credentials: 'same-origin',
    headers: body && !multipart ? { 'Content-Type': 'application/json' } : {},
    body: body ? multipart ? body : JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data.message || 'Não foi possível concluir. Tente novamente.', data.details);
  return data;
}
export const phoneMask = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : '';
  const rest = digits.slice(2);
  const split = rest.length > 8 ? 5 : 4;
  return `(${digits.slice(0, 2)}) ${rest.slice(0, split)}${rest.length > split ? '-' + rest.slice(split) : ''}`;
};
