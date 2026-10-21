export type AppIdentity = { id: string; email: string; name: string };

/** Only verified Clerk claims may reach this function. Fail closed if the bridge is absent. */
export function identityFromClaims(claims: Record<string, unknown> | null | undefined): AppIdentity | null {
  const id = claims?.userId;
  const email = claims?.email;
  if (typeof id !== 'string' || !id.trim() || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return {
    id,
    email,
    name: [claims?.firstName, claims?.lastName].filter(value => typeof value === 'string' && value.trim()).join(' '),
  };
}
