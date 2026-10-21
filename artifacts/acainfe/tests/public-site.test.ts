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
import { SITE_ROUTES, isValidPage } from '../src/lib/site-routes';
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
    app.use(express.static('public', { index: false }));
    // Existing API behavior is not overridden by the public page handler.
    app.get('/api/example', (_req, res) => res.json({ ok: true }));
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
    assert.equal(document.querySelector('meta[property="og:image"]')!.getAttribute('content'), 'https://acainfe.com/api/og.png');
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
    for (const path of ['/', '/sign-in', '/sign-up', '/sign-in/sso-callback', '/sign-up/verify-email-address', '/onboarding', '/app', '/app/conta', '/sobre', '/contato', '/privacidade', '/llms.txt', '/robots.txt', '/favicon.svg', '/api/example']) {
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
    assert.deepEqual([...dom.window.document.querySelectorAll('loc')].map(n => n.textContent), ['https://acainfe.com/', 'https://acainfe.com/sobre', 'https://acainfe.com/contato', 'https://acainfe.com/privacidade', 'https://acainfe.com/llms.txt']);
    assert.deepEqual([...dom.window.document.querySelectorAll('lastmod')].map(n => n.textContent), Array(5).fill(publishedAt));
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
      for (const path of ['/sobre', '/contato', '/privacidade']) assert.ok(doc.querySelector(`footer a[href="${path}"]`));
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
