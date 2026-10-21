import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { isAllowedAppRoute } from './app-routes';

/** Mounted after authentication. Certificate trust and ownership are enforced upstream. */
export function createAppApi(proxy: RequestHandler) {
  const router = Router();
  router.use((req, res, next) => {
    if (!isAllowedAppRoute(req.method, req.path)) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Rota não encontrada.' });
      return;
    }
    next();
  });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 1 } });
  router.post('/onboarding/certificate', upload.single('file'), (req, res, next) => {
    if (!req.file || !/\.(pfx|p12)$/i.test(req.file.originalname) || typeof req.body?.password !== 'string' || !req.body.password) {
      req.file?.buffer.fill(0);
      if (req.body?.password) delete req.body.password;
      res.status(422).json({ error: 'VALIDATION', message: 'Envie um certificado .pfx ou .p12 e sua senha.' });
      return;
    }
    next();
  });
  router.use(proxy);
  return router;
}
