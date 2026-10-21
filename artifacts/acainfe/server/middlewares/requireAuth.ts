import { getAuth } from '@clerk/express';
import type { RequestHandler } from 'express';
import { identityFromClaims, type AppIdentity } from '../user-identity';

declare global {
  namespace Express {
    interface Request { appIdentity?: AppIdentity }
  }
}

// The existing user bridge lives in the upstream API, not a local users table.
// Keep x-user-id keyed on the original subject, never Clerk's native auth.userId.
export const requireAuth: RequestHandler = (req, res, next) => {
  const auth = getAuth(req);
  const identity = auth.userId ? identityFromClaims(auth.sessionClaims) : null;
  if (!identity) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Entre com uma conta com e-mail válido para continuar.' });
    return;
  }
  req.appIdentity = identity;
  next();
};
