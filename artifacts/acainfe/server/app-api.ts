import { Router, type RequestHandler } from 'express';
import { isAllowedAppRoute } from './app-routes';

/**
 * Mounted after authentication. Never send certificate claims to the legacy
 * upstream: it can add owners and replace signing material before responding.
 * A check after proxying (or a user's /me preflight) cannot protect other tenants.
 */
export function createAppApi(proxy: RequestHandler) {
  const router = Router();
  router.use((req, res, next) => {
    if (!isAllowedAppRoute(req.method, req.path)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Rota não encontrada.' });
      return;
    }
    next();
  });
  router.post('/onboarding/certificate', (_req, res) => {
    res.status(503).json({
      error: 'CERTIFICATE_ONBOARDING_UNAVAILABLE',
      message: 'O envio de certificados está temporariamente indisponível por segurança. Nenhuma empresa ou certificado foi alterado.',
    });
  });
  router.use(proxy);
  return router;
}
