import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createServer, type ViteDevServer } from 'vite';
import { createPublicSiteRouter, fillPublicHtml, landingMarkdown, NOT_FOUND_MARKDOWN, safeJson, structuredData } from '../server/public-site';
import { FALLBACK_COVERAGE } from '../src/lib/coverage';
import { HOME_TITLE, homeDescription, type PublicSiteData } from '../src/lib/public-site-content';
import { SITE_ROUTES, PUBLIC_PAGE_ALIASES, isValidPage, publicCanonicalUrl } from '../src/lib/site-routes';
import { setPublicCanonical } from '../src/lib/public-metadata';
import SwaggerParser from '@apidevtools/swagger-parser';
import { publicOpenApi } from '../server/public-api-schema';
import { createAgentResourcesRouter, publicMcpServerCard } from '../server/agent-resources';
import { INSTITUTIONAL_PAGES, institutionalPage, institutionalMarkdown } from '../src/lib/institutional-content';

const data: PublicSiteData = { pricing: { pricePerInvoiceCents: 80, monthlyFeeCents: 0 }, coverage: FALLBACK_COVERAGE };
const publishedAt = '2026-10-21T12:00:00.000Z';

describe('Site público para navegadores e agentes — sem API externa', () => {
  let vite: ViteDevServer, server: Server, base: string, html: string, template: string;
  before(async () => {
    vite = await createServer({
      configFile: false, envFile: false, root: process.cwd(), appType: 'custom',
      esbuild: { jsx: 'automatic' },
      resolve: { alias: { '@': `${process.cwd()}/src` }, dedupe: ['react', 'react-dom'] },
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      optimizeDeps: { noDiscovery: true },
    });
    const { renderLanding, renderPublicPage } = await vite.ssrLoadModule('/src/entry-server.tsx');
    html = renderLanding(data);
    template = await readFile('index.html', 'utf8');
    const app = express();
    app.use(await createAgentResourcesRouter({
      fetcher: async () => new Response('', { status: 404 }),
      warn: () => {},
    }));
    app.use(express.static('public', { index: false }));
    // Existing API behavior is not overridden by the public page handler.
    app.get('/api/example', (_req, res) => res.json({ ok: true }));
    // Include the actual dev middleware so download routes cannot silently
    // become Vite browser modules instead of the original CLI source.
    app.use(vite.middlewares);
    app.use(createPublicSiteRouter({
      data: async () => data, publishedAt,
      html: async (req, state, home, notFound) => fillPublicHtml(template, 'https://acainfe.com', state,
        home ? html : institutionalPage(req.path) ? renderPublicPage(state, req.path) : notFound ? '<main><h1>Essa página não está por aqui.</h1><a href="/">Voltar ao início</a></main>' : '', home, req.path),
    }));
    server = await new Promise<Server>(resolve => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  });
  after(async () => {
    await new Promise<void>((resolve, reject) => server?.close(e => e ? reject(e) : resolve()));
    await vite?.close();
  });

  it('entrega HTML completo sem JavaScript, 200, Vary Accept e um único h1', async () => {
    const response = await fetch(base, { headers: { accept: 'text/html' } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type')!, /^text\/html; charset=utf-8$/);
    assert.match(response.headers.get('vary')!, /Accept/);
    const dom = new JSDOM(await response.text());
    const document = dom.window.document;
    assert.ok(document.querySelector('#root')!.textContent!.length > 500);
    assert.equal(document.querySelectorAll('h1').length, 1);
    assert.ok(document.querySelector('h1')!.textContent!.includes('NFS-e'));
    assert.equal(document.querySelector('#root')!.getAttribute('data-prerendered'), 'true');
    for (const text of ['Conecte sua plataforma', 'Configure seus serviços', 'Preço', '0,80', 'São Paulo', 'São Bernardo do Campo', 'MEI e Simples Nacional', 'Agentes de IA e MCP', 'Minha cidade já é atendida?']) {
      assert.ok(document.querySelector('#root')!.textContent!.includes(text), text);
    }
    let level = 0;
    for (const heading of document.querySelectorAll('h1,h2,h3')) {
      const next = Number(heading.tagName[1]);
      assert.ok(next <= level + 1, `Hierarquia inválida: ${heading.outerHTML}`);
      level = next;
    }
    assert.equal(document.title, HOME_TITLE);
    assert.equal(document.querySelector('meta[name="description"]')!.getAttribute('content'), homeDescription(data.pricing));
    assert.equal(document.querySelector('meta[property="og:image"]')!.getAttribute('content'), 'https://acainfe.com/api/og.png?v=2');
    assert.equal(document.querySelector('meta[property="og:image:alt"]')!.getAttribute('content'), 'açaínfe: Vendeu. A nota foi. NFS-e automática para AbacatePay');
    assert.equal(document.querySelector('meta[name="twitter:image"]')!.getAttribute('content'), 'https://acainfe.com/api/og.png?v=2');
    dom.window.close();
  });

  it('entrega Markdown equivalente, 200, charset e Vary Accept', async () => {
    const response = await fetch(base, { headers: { accept: 'text/markdown' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/markdown; charset=utf-8');
    assert.match(response.headers.get('vary')!, /Accept/);
    const text = await response.text();
    for (const section of ['## Como funciona', '## Preço', '## Cidades atendidas', '## Agentes de IA e MCP', '## Dúvidas']) assert.ok(text.includes(section));
    assert.ok(text.includes('https://acainfe.com/llms.txt'));
    assert.ok(text.includes('São Paulo/SP'));
    assert.ok(text.includes('São Bernardo do Campo/SP'));
    assert.ok(text.includes('0,80'));
    assert.ok(!text.includes('<div'));
  });

  it('respeita prioridade do Accept e não troca o HTML de navegador por Markdown', async () => {
    for (const accept of ['*/*', 'text/html,application/xhtml+xml,*/*;q=0.8', 'text/markdown;q=0.2,text/html;q=0.9', 'text/markdown;q=0']) {
      const response = await fetch(base, { headers: { accept } });
      assert.match(response.headers.get('content-type')!, /^text\/html/);
    }
    const response = await fetch(base, { headers: { accept: 'text/html;q=0.2,text/markdown;q=0.9' } });
    assert.match(response.headers.get('content-type')!, /^text\/markdown/);
  });

  it('URL inexistente retorna 404 real em HTML e Markdown, com o texto solicitado', async () => {
    const browser = await fetch(base + '/nao-existe');
    assert.equal(browser.status, 404);
    assert.match(browser.headers.get('content-type')!, /^text\/html; charset=utf-8$/);
    assert.match(await browser.text(), /Essa página não está por aqui/);
    const agent = await fetch(base + '/nao-existe', { headers: { accept: 'text/markdown' } });
    assert.equal(agent.status, 404);
    assert.equal(agent.headers.get('content-type'), 'text/markdown; charset=utf-8');
    assert.equal(await agent.text(), NOT_FOUND_MARKDOWN);
    assert.match(agent.headers.get('vary')!, /Accept/);
  });

  it('mantém 200 para rotas válidas, callbacks de login e futuras páginas públicas', async () => {
    for (const path of ['/', '/sign-in', '/sign-up', '/sign-in/sso-callback', '/sign-up/verify-email-address', '/onboarding', '/app', '/app/conta', '/sobre', '/contato', '/privacidade', '/developers', '/about', '/contact', '/privacy', '/llms.txt', '/robots.txt', '/favicon.svg', '/api/example']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
    }
    assert.ok(Object.values(SITE_ROUTES).filter(p => !p.endsWith('/*?')).every(isValidPage));
    for (const path of ['/sign-inventado', '/app/nao-existe', '/sobre/nao-existe', '/nao-existe']) assert.equal(isValidPage(path), false);
    const json = await fetch(base + '/api/example');
    assert.match(json.headers.get('content-type')!, /^application\/json/);
  });

  it('gera um único JSON-LD com o grafo completo e preço público', () => {
    const dom = new JSDOM(fillPublicHtml(template, 'https://acainfe.com', data, html, true));
    const scripts = dom.window.document.querySelectorAll('script[type="application/ld+json"]');
    assert.equal(scripts.length, 1);
    const graph = JSON.parse(scripts[0].textContent!);
    assert.deepEqual(graph, structuredData(data));
    assert.equal(graph['@graph'].length, 2);
    const [software, org] = graph['@graph'];
    assert.equal(software['@id'], 'https://acainfe.com/#software');
    assert.equal(software.offers.price, '0.80');
    assert.equal(software.publisher['@id'], org['@id']);
    assert.equal(org.taxID, '28.095.894/0001-60');
    assert.equal(org.telephone, '+55-11-3458-7367');
    assert.equal(org.address.postalCode, '09751-000');
    assert.equal(org.contactPoint.contactType, 'customer support');
    assert.equal(structuredData({ ...data, pricing: { ...data.pricing, pricePerInvoiceCents: 123 } })['@graph'][0].offers?.price, '1.23');
    dom.window.close();
  });

  it('publica sitemap XML válido, só com páginas públicas e lastmod estável', async () => {
    const response = await fetch(base + '/sitemap.xml');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/xml; charset=utf-8');
    const dom = new JSDOM(await response.text(), { contentType: 'text/xml' });
    assert.equal(dom.window.document.documentElement.namespaceURI, 'http://www.sitemaps.org/schemas/sitemap/0.9');
    assert.deepEqual([...dom.window.document.querySelectorAll('loc')].map(n => n.textContent), ['https://acainfe.com/', 'https://acainfe.com/sobre', 'https://acainfe.com/contato', 'https://acainfe.com/privacidade', 'https://acainfe.com/developers', 'https://acainfe.com/llms.txt']);
    assert.deepEqual([...dom.window.document.querySelectorAll('lastmod')].map(n => n.textContent), Array(6).fill(publishedAt));
    dom.window.close();
  });

  it('mantém robots e acrescenta sitemap; conteúdo público não expõe rotas internas', async () => {
    const response = await fetch(base + '/robots.txt');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.equal(await response.text(), 'User-agent: *\nAllow: /\nSitemap: https://acainfe.com/sitemap.xml\n');
    const publicText = fillPublicHtml(template, 'https://acainfe.com', data, html, true) + landingMarkdown(data);
    for (const forbidden of ['/v1/admin', 'x-app-key', 'ACAINFE_APP_KEY', 'CLERK_SECRET_KEY']) assert.ok(!publicText.includes(forbidden));
  });

  it('serializa dados públicos sem permitir fechamento de script ou injeção de HTML', () => {
    const malicious = '</script><script>alert("x")</script>';
    assert.ok(!safeJson({ value: malicious }).includes('<'));
    assert.equal(JSON.parse(safeJson({ value: malicious })).value, malicious);
  });

  it('llms.txt entrega exatamente o arquivo aprovado, sem interpolar ou inventar ferramentas', async () => {
    const approved = await readFile('content/llms.txt', 'utf8');
    for (const accept of ['text/plain', 'text/html', 'text/markdown']) {
      const response = await fetch(base + '/llms.txt', { headers: { accept } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
      assert.equal(await response.text(), approved);
    }
    assert.ok(approved.startsWith('# açaínfe\n\n> Emissor de NFS-e'));
    assert.ok(approved.includes('Authorization: Bearer <chave>'));
    assert.ok(approved.includes('R$ 82,20 = 8220'));
    assert.ok(approved.includes('2,01% = 201'));
    assert.ok(!approved.includes('/v1/admin'));
  });

  for (const page of INSTITUTIONAL_PAGES) {
    it(`${page.path}: HTML pré-renderizado, metadados próprios, rodapé e pelo menos 500 caracteres`, async () => {
      const response = await fetch(base + page.path, { headers: { accept: 'text/html' } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
      assert.match(response.headers.get('vary')!, /Accept/);
      const dom = new JSDOM(await response.text());
      const doc = dom.window.document;
      assert.equal(doc.title, `${page.title} — açaínfe`);
      assert.equal(doc.querySelectorAll('h1').length, 1);
      assert.ok(doc.querySelector('main')!.textContent!.length >= 500);
      assert.equal(doc.querySelector('#root')!.getAttribute('data-prerendered'), 'true');
      assert.equal(doc.querySelector('meta[name="description"]')!.getAttribute('content'), page.description);
      for (const section of page.sections) {
        assert.ok(doc.querySelector('main')!.textContent!.includes(section.title));
        for (const text of section.paragraphs) assert.ok(doc.querySelector('main')!.textContent!.includes(text));
      }
      for (const path of ['/sobre', '/contato', '/privacidade', '/developers']) assert.ok(doc.querySelector(`footer a[href="${path}"]`));
      assert.equal(doc.querySelector('header nav a[href="/developers"]')?.textContent, 'API e MCP');
      assert.equal(doc.querySelector('footer a[href="/developers"]')?.textContent, 'API e MCP');
      assert.ok(doc.querySelector('a[href="mailto:contato@extractify.com.br"]'));
      assert.equal(doc.querySelectorAll('script[type="application/ld+json"]').length, 0);
      dom.window.close();
    });
    it(`${page.path}: Markdown com o mesmo conteúdo, charset e Vary Accept`, async () => {
      const response = await fetch(base + page.path, { headers: { accept: 'text/markdown' } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'text/markdown; charset=utf-8');
      assert.match(response.headers.get('vary')!, /Accept/);
      const text = await response.text();
      assert.equal(text, institutionalMarkdown(page));
      assert.ok(text.length >= 500);
      for (const section of page.sections) for (const paragraph of section.paragraphs) assert.ok(text.includes(paragraph));
    });
  }

  it('landing liga a documentação no menu, no rodapé e no Markdown; llms.txt inclui o novo item', async () => {
    const response = await fetch(base);
    const dom = new JSDOM(await response.text());
    assert.equal(dom.window.document.querySelector('header nav a[href="/developers"]')?.textContent, 'API e MCP');
    assert.equal(dom.window.document.querySelector('footer a[href="/developers"]')?.textContent, 'API e MCP');
    assert.ok(landingMarkdown(data).includes('https://acainfe.com/developers'));
    const llms = await (await fetch(base + '/llms.txt')).text();
    assert.ok(llms.includes('- [API e agentes](https://acainfe.com/developers): autenticação, rotas e exemplos'));
    dom.window.close();
  });

  it('developers documenta somente as rotas e o exemplo aprovados, em HTML e Markdown', async () => {
    const page = institutionalPage('/developers')!;
    const dom = new JSDOM(await (await fetch(base + page.path)).text());
    const doc = dom.window.document;
    assert.equal(doc.querySelector('h1')!.textContent, 'API e agentes de IA');
    assert.equal(doc.querySelector('a[href="https://api.acainfe.com/openapi.json"]')?.textContent, 'Contrato completo da API pública (OpenAPI JSON)');
    assert.ok((await (await fetch(base + '/developers', { headers: { accept: 'text/markdown' } })).text())
      .includes('[Contrato completo da API pública (OpenAPI JSON)](https://api.acainfe.com/openapi.json)'));
    const command = `curl -X POST https://api.acainfe.com/v1/sales -H "x-api-key: <chave>" -H "Content-Type: application/json" -d '{"externalId":"pedido-123","customer":{"name":"Ana Souza","taxId":"52998224725","email":"ana@exemplo.com"},"items":[{"productExternalId":"prod_abc","totalCents":9700}]}'`;
    assert.equal(doc.querySelector('pre code')!.textContent, command);
    const markdown = await (await fetch(base + page.path, { headers: { accept: 'text/markdown' } })).text();
    assert.ok(markdown.includes(`\`\`\`bash\n${command}\n\`\`\``));
    for (const text of ['x-api-key', 'Authorization: Bearer <chave>', 'POST /v1/sales', 'GET /v1/invoices', 'GET /v1/invoices/{id}', 'POST /v1/invoices/{id}/cancel', 'GET /v1/products', 'POST /v1/products', 'GET /v1/public/pricing', 'GET /v1/public/coverage', 'assíncrona', 'R$ 82,20 = 8220', '2,01% = 201', 'HTTP streamable']) {
      assert.ok(doc.querySelector('main')!.textContent!.includes(text), text);
      assert.ok(markdown.includes(text), text);
    }
    for (const href of ['/llms.txt', 'https://api.acainfe.com/docs']) assert.ok(doc.querySelector(`main a[href="${href}"]`));
    for (const forbidden of ['/v1/app', '/v1/admin', 'x-app-key', 'ACAINFE_APP_KEY', 'CLERK_SECRET_KEY']) {
      assert.ok(!doc.documentElement.textContent!.includes(forbidden));
      assert.ok(!markdown.includes(forbidden));
    }
    dom.window.close();
  });

  it('/docs redireciona permanentemente para /developers, inclusive quando o cliente pede Markdown', async () => {
    for (const accept of ['text/html', 'text/markdown']) {
      const response = await fetch(base + '/docs', { redirect: 'manual', headers: { accept } });
      assert.equal(response.status, 301);
      assert.equal(response.headers.get('location'), '/developers');
    }
    assert.match((await fetch(base + '/api/example')).headers.get('content-type')!, /^application\/json/);
  });

  for (const path of ['/', '/sobre', '/contato', '/privacidade', '/developers', ...Object.keys(PUBLIC_PAGE_ALIASES)]) {
    it(`${path}: canonical, og:url, idioma e imagem saem no HTML do servidor`, async () => {
      const response = await fetch(base + path, { headers: { accept: 'text/html' } });
      const dom = new JSDOM(await response.text());
      const doc = dom.window.document, canonical = publicCanonicalUrl(path);
      assert.equal(doc.documentElement.lang, 'pt-BR');
      assert.equal(doc.querySelectorAll('link[rel="canonical"]').length, 1);
      assert.equal(doc.querySelector('link[rel="canonical"]')?.getAttribute('href'), canonical);
      assert.equal(doc.querySelector('meta[property="og:url"]')?.getAttribute('content'), canonical);
      assert.equal(doc.querySelector('meta[property="og:type"]')?.getAttribute('content'), 'website');
      assert.equal(doc.querySelector('meta[property="og:image"]')?.getAttribute('content'), 'https://acainfe.com/api/og.png?v=2');
      assert.ok(response.headers.get('link')?.includes(`<${canonical}>; rel="canonical"`));
      dom.window.close();
    });
  }

  for (const [alias, original] of Object.entries(PUBLIC_PAGE_ALIASES)) {
    it(`${alias}: 200 sem redirect, mesmo conteúdo da versão portuguesa e Markdown`, async () => {
      assert.equal(isValidPage(alias), true);
      const response = await fetch(base + alias, { redirect: 'manual' });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('location'), null);
      assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
      assert.match(response.headers.get('vary')!, /Accept/);
      const dom = new JSDOM(await response.text());
      const originalDom = new JSDOM(await (await fetch(base + original)).text());
      const text = dom.window.document.querySelector('main')!.textContent!;
      assert.equal(text, originalDom.window.document.querySelector('main')!.textContent);
      assert.ok(text.length >= 500);
      const markdown = await fetch(base + alias, { headers: { accept: 'text/markdown' }, redirect: 'manual' });
      assert.equal(markdown.status, 200);
      assert.equal(markdown.headers.get('content-type'), 'text/markdown; charset=utf-8');
      assert.match(markdown.headers.get('vary')!, /Accept/);
      assert.ok(markdown.headers.get('link')?.includes(`<https://acainfe.com${original}>; rel="canonical"`));
      assert.equal(await markdown.text(), institutionalMarkdown(institutionalPage(original)!));
      assert.equal(institutionalPage(alias + '/'), institutionalPage(original));
      dom.window.close(); originalDom.window.close();
    });
  }

  it('mantém canonical e og:url corretos nas transições do app, sem duplicar tags', () => {
    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', { value: dom.window.document, configurable: true });
    try {
      for (const path of ['/developers', '/about', '/privacy', '/contact', '/']) {
        setPublicCanonical(path);
        assert.equal(dom.window.document.querySelector('link[rel="canonical"]')?.getAttribute('href'), publicCanonicalUrl(path));
        assert.equal(dom.window.document.querySelector('meta[property="og:url"]')?.getAttribute('content'), publicCanonicalUrl(path));
        assert.equal(dom.window.document.querySelectorAll('link[rel="canonical"]').length, 1);
        assert.equal(dom.window.document.querySelectorAll('meta[property="og:url"]').length, 1);
      }
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'document', descriptor);
      else Reflect.deleteProperty(globalThis, 'document');
      dom.window.close();
    }
  });

  it('mantém a reserva OpenAPI 3.1 válida com oito operações quando a API está indisponível', async () => {
    const response = await fetch(base + '/openapi.json');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    const spec = await response.json();
    await SwaggerParser.validate(structuredClone(spec));
    assert.equal(spec.openapi, '3.1.0');
    assert.deepEqual(spec.servers, [{ url: 'https://api.acainfe.com' }]);
    assert.deepEqual(spec, publicOpenApi);
    assert.deepEqual(Object.keys(spec.paths), [
      '/v1/sales', '/v1/invoices', '/v1/invoices/{id}', '/v1/invoices/{id}/cancel',
      '/v1/products', '/v1/public/pricing', '/v1/public/coverage',
    ]);
    const ids = new Set<string>();
    for (const methods of Object.values(spec.paths) as any[]) for (const operation of Object.values(methods) as any[]) {
      assert.ok(operation.operationId && !ids.has(operation.operationId));
      ids.add(operation.operationId);
      assert.ok(operation.description.length > 20);
      for (const parameter of operation.parameters ?? []) assert.equal(parameter.schema.type, 'string');
      if (operation.requestBody) assert.equal(operation.requestBody.content['application/json'].schema.type, 'object');
      for (const result of Object.values(operation.responses) as any[]) {
        assert.ok(result.description);
        assert.ok(result.content['application/json'].schema);
      }
    }
    assert.equal(ids.size, 8);
    const text = JSON.stringify(spec);
    for (const forbidden of ['/v1/admin', '/v1/app', '/v1/tenants', 'x-admin-key', 'x-app-key', 'ACAINFE_APP_KEY']) assert.ok(!text.includes(forbidden));
    assert.equal(spec.paths['/v1/public/pricing'].get.security.length, 0);
    assert.equal(spec.paths['/v1/public/coverage'].get.security.length, 0);
    assert.equal(spec.components.securitySchemes.apiKey.name, 'x-api-key');
    assert.equal(spec.components.securitySchemes.bearerAuth.scheme, 'bearer');
    const sale = spec.paths['/v1/sales'].post;
    assert.ok(sale.responses['202']);
    assert.equal(sale.requestBody.content['application/json'].schema.properties.items.items.properties.totalCents.type, 'integer');
    // No made-up response fields to hide the missing upstream contract.
    assert.equal(sale.responses['202'].content['application/json'].schema.type, undefined);
    assert.match(sale.responses['202'].content['application/json'].schema.description, /não especifica/);
  });

  it('recursos de agentes são públicos, têm tipos corretos, CORS restrito às rotas novas e cache condicional', async () => {
    const resources = [
      ['/openapi.json', 'application/json'],
      ['/.well-known/mcp.json', 'application/json'],
      ['/.well-known/mcp/server-card.json', 'application/json'],
      ['/mcp.json', 'application/json'],
      ['/agent-instructions.md', 'text/markdown'],
      ['/cli/acainfe.mjs', 'application/javascript'],
      ['/cli/README.md', 'text/markdown'],
    ];
    for (const [path, type] of resources) {
      const response = await fetch(base + path, { headers: { accept: '*/*', origin: 'https://client.example' } });
      assert.equal(response.status, 200, path);
      assert.equal(response.headers.get('content-type'), `${type}; charset=utf-8`);
      assert.equal(response.headers.get('access-control-allow-origin'), '*');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('cache-control'), ['/openapi.json', '/.well-known/mcp.json', '/.well-known/mcp/server-card.json'].includes(path)
        ? 'public, max-age=3600' : 'public, max-age=300');
      const etag = response.headers.get('etag')!;
      assert.ok(etag);
      const cached = await fetch(base + path, { headers: { 'If-None-Match': etag, 'Cache-Control': 'max-age=0' } });
      assert.equal(cached.status, 304, path);
      assert.equal(await cached.text(), '');
      const head = await fetch(base + path, { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(await head.text(), '');
      const options = await fetch(base + path, { method: 'OPTIONS' });
      assert.equal(options.status, 204);
      assert.equal(options.headers.get('access-control-allow-methods'), 'GET, HEAD, OPTIONS');
    }
    const api = await fetch(base + '/api/example');
    assert.equal(api.headers.get('access-control-allow-origin'), null);
    const cli = await (await fetch(base + '/cli/acainfe.mjs')).text();
    assert.equal(cli, await readFile('cli/acainfe.mjs', 'utf8'));
  });

  it('instruções when-to-use e configuração MCP dizem como usar sem inventar manifesto nem ferramentas', async () => {
    const instructions = await (await fetch(base + '/agent-instructions.md')).text();
    assert.match(instructions, /## When to use/);
    for (const phrase of ['MEI', 'Simples Nacional', 'São Paulo', 'São Bernardo do Campo', 'Do not use', 'Streamable HTTP', 'at runtime', 'integer cents', 'basis points']) assert.ok(instructions.includes(phrase));
    const config = await (await fetch(base + '/mcp.json')).json();
    assert.deepEqual(config, { mcpServers: { acainfe: {
      type: 'http', url: 'https://api.acainfe.com/mcp', headers: { Authorization: 'Bearer <SUA_CHAVE>' },
    } } });
    const llms = await (await fetch(base + '/llms.txt')).text();
    assert.match(llms, /## Quando usar \(When to use\)/);
    for (const path of ['/agent-instructions.md', '/openapi.json', '/mcp.json', '/cli/README.md']) assert.ok(llms.includes(`https://acainfe.com${path}`));
    assert.ok(llms.includes('não é um manifesto de protocolo'));
    assert.ok(llms.includes('contrato completo da API pública'));
    assert.ok(llms.includes('[Servidor MCP (JSON)](https://acainfe.com/.well-known/mcp.json): endereço, transporte e autenticação do servidor MCP'));
    assert.ok(isValidPage('/openapi.json'));
    assert.ok(isValidPage('/.well-known/mcp.json'));
    assert.ok(isValidPage('/.well-known/mcp/server-card.json'));
    const card = await fetch(base + '/.well-known/mcp.json');
    assert.equal(card.status, 200);
    assert.deepEqual(await card.json(), publicMcpServerCard);
    assert.deepEqual(await (await fetch(base + '/.well-known/mcp/server-card.json')).json(), publicMcpServerCard);
    const cliDocs = await (await fetch(base + '/cli/README.md')).text();
    assert.ok(cliDocs.includes('npm ainda não foi publicada'));
    assert.ok(cliDocs.includes('Não use `npx acainfe-cli`'));
  });

  it('descoberta por HTML e cabeçalhos liga OpenAPI e instruções sem alterar conteúdo visual', async () => {
    for (const path of ['/', '/developers', '/about']) {
      const response = await fetch(base + path);
      const dom = new JSDOM(await response.text());
      const doc = dom.window.document;
      assert.equal(doc.querySelector('head link[rel="service-desc"]')?.getAttribute('href'), 'https://acainfe.com/openapi.json');
      assert.equal(doc.querySelector('head link[rel="describedby"]')?.getAttribute('href'), 'https://acainfe.com/agent-instructions.md');
      assert.equal(doc.querySelector('head link[rel="service-doc"]')?.getAttribute('href'), 'https://acainfe.com/developers');
      assert.ok(response.headers.get('link')?.includes('rel="service-desc"'));
      assert.ok(response.headers.get('link')?.includes('rel="describedby"'));
      if (path === '/') {
        assert.match(doc.querySelector('meta[name="description"]')!.getAttribute('content')!, /EXTRACTIFY TECNOLOGIA LTDA/);
        const graph = JSON.parse(doc.querySelector('script[type="application/ld+json"]')!.textContent!);
        assert.equal(graph['@graph'][1].name, 'EXTRACTIFY TECNOLOGIA LTDA');
      }
      dom.window.close();
    }
    const markdown = await (await fetch(base, { headers: { accept: 'text/markdown' } })).text();
    for (const path of ['/openapi.json', '/agent-instructions.md', '/mcp.json', '/cli/README.md']) assert.ok(markdown.includes(path));
    const llms = await fetch(base + '/llms.txt');
    assert.ok(llms.headers.get('link')?.includes('rel="service-desc"'));
  });

  it('developers publica a política aprovada e todos os códigos de erro em HTML e Markdown', async () => {
    const policy = 'A versão da API está no caminho (/v1). Dentro de uma versão, só entram mudanças compatíveis: novos campos, novas rotas e novos valores opcionais. Uma mudança incompatível só sai numa nova versão (/v2). Uma rota ou versão descontinuada continua funcionando por pelo menos 90 dias, responde com os cabeçalhos Deprecation (RFC 9745) e Sunset (RFC 8594) e é anunciada nesta página e no llms.txt.';
    const response = await fetch(base + '/developers');
    assert.equal(response.status, 200);
    const dom = new JSDOM(await response.text());
    const doc = dom.window.document;
    const text = doc.body.textContent!;
    for (const title of ['Versionamento e descontinuação', 'Erros']) {
      assert.ok([...doc.querySelectorAll('h2')].some(heading => heading.textContent === title));
    }
    assert.ok(text.includes(policy));
    const markdown = await (await fetch(base + '/developers', { headers: { accept: 'text/markdown' } })).text();
    assert.ok(markdown.includes('## Versionamento e descontinuação'));
    assert.ok(markdown.includes('## Erros'));
    assert.ok(markdown.includes(policy));
    for (const expected of [
      '{ "error": "<CÓDIGO>", "message": "...", "details": {...} }',
      'VALIDATION (422)', 'NOT_FOUND (404)', 'CONFLICT e INVALID_STATE (409)',
      'UNAUTHORIZED (401)', 'CERTIFICATE_INVALID e CERTIFICATE_MISSING (422)',
      'UNAVAILABLE (503)', 'pode tentar de novo', 'INTERNAL (500)',
    ]) {
      assert.ok(text.includes(expected), expected);
      assert.ok(markdown.includes(expected), expected);
    }
    dom.window.close();
  });

  it('llms publica a política em uma frase, após Como um agente usa e antes das páginas', async () => {
    const response = await fetch(base + '/llms.txt');
    assert.equal(response.status, 200);
    const text = await response.text();
    const expected = 'A versão da API está no caminho (/v1); dentro de uma versão, só entram mudanças compatíveis: novos campos, novas rotas e novos valores opcionais; uma mudança incompatível só sai numa nova versão (/v2); uma rota ou versão descontinuada continua funcionando por pelo menos 90 dias, responde com os cabeçalhos Deprecation (RFC 9745) e Sunset (RFC 8594) e é anunciada nesta página e no llms.txt.';
    assert.ok(text.includes(`## Versionamento\n\n${expected}\n\n## Páginas`));
    assert.ok(text.indexOf('## Como um agente usa') < text.indexOf('## Versionamento'));
  });

  it('privacidade contém só os 12 tópicos aprovados e a versão e aviso no topo', async () => {
    const privacy = institutionalPage('/privacidade')!;
    assert.equal(privacy.sections.length, 12);
    assert.equal(privacy.version, 'Versão de 21/10/2026');
    assert.equal(privacy.notice, 'Esta política está em revisão.');
    const markdown = institutionalMarkdown(privacy);
    assert.ok(markdown.indexOf(privacy.version) < markdown.indexOf('## 1. Quem somos'));
    assert.ok(markdown.indexOf(privacy.notice!) < markdown.indexOf('## 1. Quem somos'));
    assert.ok(markdown.includes('só aceitamos e-CNPJ emitidos pela ICP-Brasil'));
    assert.ok(markdown.includes('o açaínfe atua como operador'));
    assert.ok(markdown.includes('Não vendemos dados.'));
    assert.ok(markdown.includes('nenhum de publicidade'));
    const response = await fetch(base + '/contato');
    assert.ok((await response.text()).includes('href="tel:+551134587367"'));
  });
});
