import express from 'express';
import multer from 'multer';
import { clerkMiddleware } from '@clerk/express';
import { publishableKeyFromHost } from '@clerk/shared/keys';
import { CLERK_PROXY_PATH, clerkProxyMiddleware, getClerkProxyHost } from './middlewares/clerkProxyMiddleware';
import { requireAuth } from './middlewares/requireAuth';
import rateLimit from 'express-rate-limit';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import { PRICE_PER_INVOICE_CENTS } from '../src/config/pricing';
import { createAppApi } from './app-api';
import { appUpstreamPath, appJsonBody } from './app-proxy-request';
import { createCoverageLoader } from './public-coverage';
import { createSocialImageRouter } from './social-image';
import { createPublicSiteRouter, fillPublicHtml } from './public-site';
import type { PublicSiteData } from '../src/lib/public-site-content';
import { institutionalPage } from '../src/lib/institutional-content';
import { agentResourcesRouter } from './agent-resources';

const app = express();
const httpServer = createHttpServer(app);
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
// Browser APIs are same-origin. Never reflect arbitrary origins with credentials:
// that would let a sibling origin read private data using Clerk session cookies.
app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.use('/api', rateLimit({ windowMs: 60000, limit: 90, standardHeaders: true, legacyHeaders: false, message: { message: 'Muitas tentativas. Aguarde um minuto.' } }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(
  '/api/app',
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    if (!origin || origin !== `${req.protocol}://${req.get('host')}`) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Origem da solicitação inválida. Atualize a página.' }); return;
    }
  }
  next();
});

function origin(req: express.Request) { return `${req.protocol}://${req.get('host')}`; }

function apiBase() { return (process.env.ACAINFE_API_URL || '').replace(/\/$/, ''); }
const getCoverage = createCoverageLoader(apiBase);
app.get('/api/public/coverage', async (_req, res) => res.json(await getCoverage()));
let cachedPricing: { pricePerInvoiceCents: number; monthlyFeeCents: number; [key: string]: unknown } | undefined;
let pricingUntil = 0;
async function getPricing() {
  if (Date.now() < pricingUntil && cachedPricing) return cachedPricing;
  try {
    if (!apiBase()) throw new Error('No API');
    const response = await fetch(`${apiBase()}/v1/public/pricing`, { signal: AbortSignal.timeout(6000), headers: { 'ngrok-skip-browser-warning': '1' } });
    if (!response.ok) throw new Error('Pricing unavailable');
    const data = await response.json();
    if (!Number.isSafeInteger(data.pricePerInvoiceCents) || data.pricePerInvoiceCents < 0) throw new Error('Invalid pricing');
    cachedPricing = data;
    pricingUntil = Date.now() + 300000;
  } catch {
    cachedPricing ??= { pricePerInvoiceCents: PRICE_PER_INVOICE_CENTS, monthlyFeeCents: 0 };
    pricingUntil = Date.now() + 60000;
  }
  return cachedPricing!;
}
app.get('/api/public/pricing', async (_req, res) => res.json(await getPricing()));
app.use(createSocialImageRouter({ pricing: getPricing, coverage: getCoverage }));
app.use('/api/app', requireAuth);
app.use('/api/app', createAppApi((req, res) => {
  if (!apiBase() || !process.env.ACAINFE_APP_KEY) {
    res.status(503).json({ error: 'NOT_CONFIGURED', message: 'A conexão com o açaínfe ainda está sendo configurada. O responsável precisa adicionar ACAINFE_APP_KEY nos Secrets.' }); return;
  }
  return proxyApi(req, res);
}));
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Rota não encontrada.' });
});
async function proxyApi(req: express.Request, res: express.Response) {
  try {
    const auth = req.appIdentity!;
    const headers: Record<string, string> = {
      'x-app-key': process.env.ACAINFE_APP_KEY!,
      'x-user-id': auth.id, 'x-user-email': auth.email,
      'x-user-name': encodeURIComponent(auth.name), 'ngrok-skip-browser-warning': '1',
    };
    let body: string | FormData | undefined;
    if (req.file) {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(req.file.buffer)]), req.file.originalname);
      form.append('password', req.body.password);
      body = form;
    } else {
      body = appJsonBody(req.method, req.body);
      if (body !== undefined) headers['Content-Type'] = 'application/json';
    }
    const upstreamPath = appUpstreamPath(req.originalUrl);
    const response = await fetch(`${apiBase()}${upstreamPath}`, { method: req.method, headers, body, redirect: 'error', signal: AbortSignal.timeout(45000) });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch {
    res.status(502).json({ error: 'UPSTREAM_UNAVAILABLE', message: 'Não conseguimos falar com o açaínfe agora. Tente novamente em instantes.' });
  } finally {
    req.file?.buffer.fill(0);
    if (req.body?.password) delete req.body.password;
  }
}
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    res.status(422).json({ error: 'VALIDATION', message: 'Arquivo inválido. Envie apenas um certificado de até 10 MB.' });
    return;
  }
  res.status(500).json({ error: 'INTERNAL', message: 'Não foi possível concluir. Tente novamente.' });
});
const root = path.resolve(import.meta.dirname, '..');
function escapeHtml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
const publicData = async (): Promise<PublicSiteData> => {
  const [pricing, coverage] = await Promise.all([getPricing(), getCoverage()]);
  // Explicitly select public fields: never serialize upstream extras or identity.
  return { pricing: { pricePerInvoiceCents: pricing.pricePerInvoiceCents, monthlyFeeCents: pricing.monthlyFeeCents }, coverage };
};
const notFoundBody = '<main style="padding:60px"><h1>Essa página não está por aqui.</h1><a href="/">Voltar ao início</a></main>';
// Serve exact machine-readable files before Vite can transform source extensions.
app.use(agentResourcesRouter);
if (process.env.NODE_ENV === 'production') {
  const { publishedAt } = JSON.parse(await readFile(path.join(root, 'dist/publication.json'), 'utf8'));
  const rendererPath = path.join(root, 'dist/server/entry-server.js');
  const { renderPublicPage } = await import(rendererPath);
  app.use(express.static(path.join(root, 'dist/public'), { index: false }));
  app.use(createPublicSiteRouter({
    data: publicData, publishedAt,
    html: async (req, data, home, notFound) => fillPublicHtml(
      await readFile(path.join(root, 'dist/public/index.html'), 'utf8'), origin(req), data,
      home || institutionalPage(req.path) ? renderPublicPage(data, req.path) : notFound ? notFoundBody : '', home, req.path,
    ),
  }));
} else {
  const vite = await createServer({ configFile: path.join(root, 'vite.config.ts'), server: { middlewareMode: true, hmr: { server: httpServer, path: '/__vite_hmr' } }, appType: 'custom' });
  app.use(vite.middlewares);
  app.use(createPublicSiteRouter({
    data: publicData, publishedAt: new Date().toISOString(),
    html: async (req, data, home, notFound) => {
      const prerendered = home || !!institutionalPage(req.path);
      const renderer = prerendered ? await vite.ssrLoadModule('/src/entry-server.tsx') : null;
      const template = fillPublicHtml(await readFile(path.join(root, 'index.html'), 'utf8'), origin(req), data,
        prerendered ? renderer!.renderPublicPage(data, req.path) : notFound ? notFoundBody : '', home, req.path);
      return vite.transformIndexHtml(req.originalUrl, template);
    },
  }));
}
httpServer.listen(Number(process.env.PORT) || 5000, '0.0.0.0', () => console.log('açaínfe ready'));
