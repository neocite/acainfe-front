import express from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import pg from 'pg';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import * as oidc from 'openid-client';
import { createServer } from 'vite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { PRICE_PER_INVOICE_CENTS, brl } from '../src/config/pricing';

declare module 'express-session' {
  interface SessionData {
    auth?: { sub: string; email: string; name: string; expiresAt: number; refreshToken?: string };
    login?: { state: string; verifier: string; nonce: string };
  }
}

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
if (!process.env.SESSION_SECRET) throw new Error('Configure SESSION_SECRET.');
app.use(session({
  secret: process.env.SESSION_SECRET,
  store: new (pgSession(session))({ pool, tableName: 'app_sessions', createTableIfMissing: false }),
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 7 * 86400000 },
}));
app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
app.use('/api', rateLimit({ windowMs: 60000, limit: 90, standardHeaders: true, legacyHeaders: false, message: { message: 'Muitas tentativas. Aguarde um minuto.' } }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    if (!origin || origin !== `${req.protocol}://${req.get('host')}`) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Origem da solicitação inválida. Atualize a página.' }); return;
    }
  }
  next();
});

let oidcConfig: Promise<oidc.Configuration> | undefined;
function getOidc() {
  return oidcConfig ??= oidc.discovery(new URL(process.env.ISSUER_URL || 'https://replit.com/oidc'), process.env.REPL_ID!, undefined, oidc.None());
}
function origin(req: express.Request) { return `${req.protocol}://${req.get('host')}`; }
app.get('/api/login', async (req, res) => {
  try {
    const config = await getOidc();
    const verifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    req.session.login = { verifier, state, nonce };
    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: `${origin(req)}/api/callback`, scope: 'openid email profile offline_access',
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256',
      state, nonce, prompt: 'login',
    });
    req.session.save(err => err ? res.redirect('/app?error=session') : res.redirect(url.href));
  } catch { res.redirect('/app?error=auth'); }
});
app.get('/api/callback', async (req, res) => {
  try {
    const login = req.session.login;
    if (!login) throw new Error('Missing login');
    const tokens = await oidc.authorizationCodeGrant(await getOidc(), new URL(req.originalUrl, origin(req)), {
      pkceCodeVerifier: login.verifier, expectedState: login.state, expectedNonce: login.nonce,
    });
    const claims = tokens.claims();
    if (!claims?.sub || typeof claims.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email)) throw new Error('Missing identity');
    const auth = {
      sub: claims.sub, email: claims.email,
      name: String(claims.name || [claims.first_name, claims.last_name].filter(Boolean).join(' ') || ''),
      expiresAt: Math.floor(Date.now() / 1000) + (tokens.expires_in ?? 3600),
      refreshToken: tokens.refresh_token,
    };
    req.session.regenerate(err => {
      if (err) return res.redirect('/app?error=session');
      req.session.auth = auth;
      req.session.save(err => res.redirect(err ? '/app?error=session' : '/app'));
    });
  } catch { res.redirect('/app?error=auth'); }
});
app.post('/api/logout', (req, res) => req.session.destroy(() => { res.clearCookie('connect.sid'); res.json({ ok: true }); }));
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.session.auth;
  if (!auth || !auth.sub?.trim() || typeof auth.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(auth.email) || !Number.isFinite(auth.expiresAt)) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Entre com uma conta com e-mail válido para continuar.' }); return;
  }
  if (Date.now() / 1000 >= auth.expiresAt) {
    try {
      if (!auth.refreshToken) throw new Error('Expired');
      const tokens = await oidc.refreshTokenGrant(await getOidc(), auth.refreshToken);
      auth.expiresAt = Math.floor(Date.now() / 1000) + (tokens.expires_in ?? 3600);
      auth.refreshToken = tokens.refresh_token ?? auth.refreshToken;
    } catch {
      req.session.destroy(() => {});
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Sua sessão expirou. Entre novamente.' }); return;
    }
  }
  next();
}
app.get('/api/auth/user', requireAuth, (req, res) => {
  const { sub, email, name } = req.session.auth!;
  res.json({ id: sub, email, name });
});

function apiBase() { return (process.env.ACAINFE_API_URL || '').replace(/\/$/, ''); }
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
app.get(['/api/og.svg', '/api/og.png'], async (req, res) => {
  const p = await getPricing();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#FFF8EE"/><text x="80" y="110" font-family="sans-serif" font-size="46" font-weight="bold" fill="#4A1942">açaínfe</text><text x="80" y="280" font-family="sans-serif" font-size="88" font-weight="bold" fill="#2A0E2E">Não vendeu?</text><text x="80" y="380" font-family="sans-serif" font-size="88" font-weight="bold" fill="#7B2D6B">Não pagou.</text><text x="80" y="500" font-family="sans-serif" font-size="30" fill="#4A1942">${brl(p.pricePerInvoiceCents)} por nota • Sem mensalidade</text><ellipse cx="970" cy="320" rx="140" ry="50" fill="#7B2D6B"/><path d="M830 320 Q850 500 970 500 Q1090 500 1110 320" fill="#4A1942"/><ellipse cx="970" cy="320" rx="115" ry="33" fill="#2A0E2E"/><circle cx="930" cy="307" r="19" fill="#FF9F1C"/><circle cx="970" cy="300" r="18" fill="#FF9F1C"/><circle cx="1010" cy="310" r="18" fill="#FF9F1C"/></svg>`;
  if (req.path.endsWith('.png')) res.type('png').send(await sharp(Buffer.from(svg)).png().toBuffer());
  else res.type('svg').send(svg);
});
app.use('/api/app', requireAuth);
const allowed = [
  ['GET', /^\/me$/], ['PUT', /^\/me$/],
  ['POST', /^\/onboarding\/certificate$/],
  ['GET', /^\/companies\/[a-zA-Z0-9_-]+$/], ['PATCH', /^\/companies\/[a-zA-Z0-9_-]+$/],
  ['PUT', /^\/companies\/[a-zA-Z0-9_-]+\/accountant$/],
  ['POST', /^\/companies\/[a-zA-Z0-9_-]+\/(?:abacatepay|mcp-key|billing\/payments)$/],
  ['GET', /^\/companies\/[a-zA-Z0-9_-]+\/(?:products|billing)$/],
] as const;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 1 } });
app.use('/api/app', (req, res, next) => {
  if (!allowed.some(([method, pattern]) => method === req.method && pattern.test(req.path))) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Rota não encontrada.' }); return;
  }
  if (!apiBase() || !process.env.ACAINFE_APP_KEY) {
    res.status(503).json({ error: 'NOT_CONFIGURED', message: 'A conexão com o açaínfe ainda está sendo configurada. O responsável precisa adicionar ACAINFE_APP_KEY nos Secrets.' }); return;
  }
  next();
});
app.post('/api/app/onboarding/certificate', upload.single('file'), proxyApi);
app.use('/api/app', proxyApi);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Rota não encontrada.' });
});
async function proxyApi(req: express.Request, res: express.Response) {
  try {
    const auth = req.session.auth!;
    const headers: Record<string, string> = {
      'x-app-key': process.env.ACAINFE_APP_KEY!,
      'x-user-id': auth.sub, 'x-user-email': auth.email,
      'x-user-name': encodeURIComponent(auth.name), 'ngrok-skip-browser-warning': '1',
    };
    let body: string | FormData | undefined;
    if (req.originalUrl.split('?')[0].endsWith('/onboarding/certificate')) {
      if (!req.file || !/\.(pfx|p12)$/i.test(req.file.originalname) || typeof req.body.password !== 'string' || !req.body.password) {
        res.status(422).json({ error: 'VALIDATION', message: 'Envie um certificado .pfx ou .p12 e sua senha.' }); return;
      }
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(req.file.buffer)]), req.file.originalname);
      form.append('password', req.body.password);
      body = form;
    } else if (!['GET', 'HEAD'].includes(req.method)) {
      headers['Content-Type'] = 'application/json'; body = JSON.stringify(req.body);
    }
    const upstreamPath = req.originalUrl.replace(/^\/api\/app/, '/v1/app');
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
  if (err instanceof multer.MulterError) { res.status(422).json({ error: 'VALIDATION', message: 'Arquivo inválido. Envie apenas um certificado de até 10 MB.' }); return; }
  res.status(500).json({ error: 'INTERNAL', message: 'Não foi possível concluir. Tente novamente.' });
});
const root = path.resolve(import.meta.dirname, '..');
function escapeHtml(value: string) { return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
async function pageHtml(template: string, req: express.Request) {
  const pricing = await getPricing();
  const description = `Não vendeu? Não pagou. NFS-e automática a cada venda no AbacatePay, por ${brl(pricing.pricePerInvoiceCents)} por nota, sem mensalidade.`;
  return template.replaceAll('__SEO_DESCRIPTION__', escapeHtml(description)).replaceAll('__APP_ORIGIN__', escapeHtml(origin(req)));
}
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(root, 'dist/public'), { index: false }));
  app.get('/{*splat}', async (req, res) => res.type('html').send(await pageHtml(await readFile(path.join(root, 'dist/public/index.html'), 'utf8'), req)));
} else {
  const vite = await createServer({ configFile: path.join(root, 'vite.config.ts'), server: { middlewareMode: true }, appType: 'spa' });
  app.get(['/', '/app'], async (req, res) => {
    const template = await pageHtml(await readFile(path.join(root, 'index.html'), 'utf8'), req);
    res.type('html').send(await vite.transformIndexHtml(req.originalUrl, template));
  });
  app.use(vite.middlewares);
}
app.listen(Number(process.env.PORT) || 5000, '0.0.0.0', () => console.log('açaínfe ready'));
