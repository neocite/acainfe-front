export type AuthUser = { id: string; email: string; name: string };

/** Respostas vazias ou HTML nunca podem liberar o cadastro. */
export function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const user = value as Partial<AuthUser>;
  return typeof user.id === 'string' && user.id.trim().length > 0
    && typeof user.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)
    && typeof user.name === 'string';
}
