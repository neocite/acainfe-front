import express, { type Request, type Response } from 'express';
import { readFile } from 'node:fs/promises';
import { isValidPage, publicCanonicalUrl, SITEMAP_PATHS } from '../src/lib/site-routes';
import { AGENT_COPY, HOME_TITLE, LANDING_STEPS, homeDescription, landingFaq, type PublicSiteData } from '../src/lib/public-site-content';
import { structuredData } from '../src/lib/public-site-schema';
export { structuredData } from '../src/lib/public-site-schema';
import { regimeLabels } from '../src/lib/coverage';
import { brl } from '../src/config/pricing';
import { institutionalPage, institutionalMarkdown } from '../src/lib/institutional-content';
import { agentDiscoveryHtml, agentDiscoveryLinks } from './agent-resources';
import { EN_HOME_TITLE, EN_IMAGE_ALT, EN_STEPS, englishDescription, englishFaq, englishRegimes, landingLanguage } from '../src/lib/landing-language';

const LLMS_TEXT = await readFile(new URL('../content/llms.txt', import.meta.url), 'utf8');

const CANONICAL = 'https://acainfe.com';
export const NOT_FOUND_MARKDOWN = '# Página não encontrada\n\nEste endereço não existe no açaínfe. Veja o que o açaínfe faz e como agentes de IA podem usá-lo em https://acainfe.com/llms.txt, ou a lista de páginas em https://acainfe.com/sitemap.xml.\n';
const escapeHtml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export const safeJson = (data: unknown) => JSON.stringify(data).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
const markdownText = (text: string) => text.replace(/([\\`*_[\]<>#])/g, '\\$1').replace(/[\r\n]+/g, ' ');

/** Reusable content negotiation for the public pages added in the next part. */
export function sendPublicPage(req: Request, res: Response, page: { html: string; markdown: string; status?: number; canonical?: string }) {
  res.vary('Accept');
  if (page.canonical) res.set('Link', `<${page.canonical}>; rel="canonical"`);
  res.append('Link', agentDiscoveryLinks.join(', '));
  const markdown = req.accepts(['text/html', 'text/markdown']) === 'text/markdown';
  return res.status(page.status ?? 200).type(markdown ? 'text/markdown; charset=utf-8' : 'text/html; charset=utf-8')
    .send(markdown ? page.markdown : page.html);
}

export function englishLandingMarkdown(data: PublicSiteData) {
  return `# açaínfe: automatic Brazilian service invoices (NFS-e)

Sold. Invoice sent.

Each approved payment on AbacatePay becomes an NFS-e — no end-of-month spreadsheets.

## How it works

${EN_STEPS.map(step => `### ${step.number}. ${step.title}\n\n${step.copy}`).join('\n\n')}

## Pricing

${landingLanguage('en').money(data.pricing.pricePerInvoiceCents)} per successfully issued invoice. ${data.pricing.monthlyFeeCents === 0 ? 'No monthly fee.' : `${landingLanguage('en').money(data.pricing.monthlyFeeCents)} monthly fee.`} No setup fee. Invoices rejected by the municipality are not charged.

## Coverage

Available for MEI and Simples Nacional businesses in these Brazilian cities. Other cities can join the waiting list.

${data.coverage.cities.map(city => `- ${markdownText(city.cityName)}/${markdownText(city.uf)} — ${markdownText(englishRegimes(city.regimes))}. ACTIVE.`).join('\n')}

## AI agents and MCP

açaínfe can be operated by AI agents via MCP (Model Context Protocol). Set up your company and connect your assistant to work with your service invoices.

[Information for AI agents](${CANONICAL}/llms.txt) · [API and MCP documentation (Portuguese)](${CANONICAL}/developers)

## FAQ

${englishFaq(data.pricing.pricePerInvoiceCents, data.coverage).map(item => `### ${item.q}\n\n${markdownText(item.a)}`).join('\n\n')}

## Get started

[Create an account](${CANONICAL}/sign-up) · [Sign in](${CANONICAL}/sign-in) · [Português](${CANONICAL}/)

açaínfe is an Extractify brand. CNPJ: 28.095.894/0001-60. Contact: contato@extractify.com.br. Independent product, not affiliated with AbacatePay.
`;
}

export function landingMarkdown(data: PublicSiteData) {
  return `# açaínfe: nota fiscal de serviço (NFS-e) automática

Vendeu. A nota foi.

Cada pagamento aprovado no AbacatePay vira uma NFS-e — sem planilha no fim do mês, sem mensalidade nos meses quietos.

## Como funciona

${LANDING_STEPS.map(s => `### ${s.number}. ${s.title}\n\n${s.copy}`).join('\n\n')}

## Preço

${brl(data.pricing.pricePerInvoiceCents)} por nota fiscal emitida com sucesso. Sem mensalidade, adesão nem taxa fixa. Não vendeu? Não pagou. Notas rejeitadas pela prefeitura não são cobradas.

## Cidades atendidas

Cidade a cidade. Com cuidado em cada nota.

Atendimento atual para MEI e empresas do Simples Nacional nas cidades abaixo. Estamos ampliando a cobertura municipal. Em outras cidades, cadastre-se para entrar na lista de espera.

${data.coverage.cities.map(c => `- ${markdownText(c.cityName)}/${markdownText(c.uf)} — ${markdownText(regimeLabels(c.regimes))}. ATIVO.`).join('\n')}

## Agentes de IA e MCP

${AGENT_COPY}

[Informações para agentes de IA](${CANONICAL}/llms.txt).

[API e agentes: autenticação, rotas e exemplos](${CANONICAL}/developers).

[Especificação OpenAPI da API pública](${CANONICAL}/openapi.json).
[Quando e como usar o açaínfe: instruções para agentes](${CANONICAL}/agent-instructions.md).
[Exemplo de configuração MCP](${CANONICAL}/mcp.json).
[CLI: download e instruções](${CANONICAL}/cli/README.md).

## Dúvidas

${landingFaq(data.pricing.pricePerInvoiceCents, data.coverage).map(f => `### ${f.q}\n\n${markdownText(f.a)}`).join('\n\n')}

## Comece

[Criar conta](${CANONICAL}/sign-up) · [Entrar](${CANONICAL}/sign-in)

O açaínfe é uma marca da Extractify. CNPJ: 28.095.894/0001-60. Contato: contato@extractify.com.br.
`;
}

export function fillPublicHtml(template: string, appOrigin: string, data: PublicSiteData, body = '', home = false, pagePath = '/') {
  const english = pagePath === '/en';
  const page = institutionalPage(pagePath);
  const prerendered = home || !!page;
  const scripts = prerendered ? `<script id="public-site-data" type="application/json">${safeJson(data)}</script>${home ? `<script type="application/ld+json">${safeJson(structuredData(data, english ? 'en' : 'pt'))}</script>` : ''}` : '';
  const title = english ? EN_HOME_TITLE : page ? `${page.title} — açaínfe` : HOME_TITLE;
  const canonical = prerendered ? publicCanonicalUrl(pagePath) : undefined;
  const localized = english ? template.replace('lang="pt-BR"', 'lang="en"').replace('content="pt_BR"', 'content="en_US"')
    .replaceAll('/api/og.png?v=2', '/api/og-en.png?v=2')
    .replaceAll('açaínfe: Vendeu. A nota foi. NFS-e automática para AbacatePay', EN_IMAGE_ALT) : template;
  return localized.replaceAll('__SEO_TITLE__', escapeHtml(title))
    .replaceAll('Não vendeu? Não pagou. — açaínfe', escapeHtml(title))
    .replace('name="twitter:title" content="açaínfe"', `name="twitter:title" content="${escapeHtml(title)}"`)
    .replaceAll('__SEO_DESCRIPTION__', escapeHtml(english ? englishDescription(data.pricing, data.coverage) : page?.description ?? homeDescription(data.pricing)))
    .replaceAll('__APP_ORIGIN__', escapeHtml(appOrigin))
    .replace('</head>', `${home ? `<link rel="alternate" hreflang="pt-BR" href="${CANONICAL}/" /><link rel="alternate" hreflang="en" href="${CANONICAL}/en" /><link rel="alternate" hreflang="x-default" href="${CANONICAL}/" />` : ''}${canonical ? `<link rel="canonical" href="${canonical}" />\n<meta property="og:url" content="${canonical}" />\n${agentDiscoveryHtml}\n` : ''}</head>`)
    .replace('<div id="root"></div>', () => `<div id="root"${prerendered ? ' data-prerendered="true"' : ''}>${body}</div>${scripts}`);
}

export function createPublicSiteRouter(options: {
  data: () => Promise<PublicSiteData>;
  html: (req: Request, data: PublicSiteData, home: boolean, notFound: boolean) => Promise<string>;
  publishedAt: string;
}) {
  const router = express.Router();
  router.get('/docs', (_req, res) => res.redirect(301, '/developers'));
  router.get('/sitemap.xml', (_req, res) => res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${SITEMAP_PATHS.map(p => `<url><loc>${CANONICAL}${p}</loc><lastmod>${options.publishedAt}</lastmod></url>`).join('')}</urlset>`,
  ));
  router.get('/llms.txt', (_req, res) => res.set('Link', agentDiscoveryLinks.join(', ')).type('text/plain; charset=utf-8').send(LLMS_TEXT));
  router.get('/{*splat}', async (req, res) => {
    const home = req.path === '/' || req.path === '/en';
    const page = institutionalPage(req.path);
    const canonical = home || page ? publicCanonicalUrl(req.path) : undefined;
    const notFound = !isValidPage(req.path);
    const data = await options.data();
    const markdown = req.path === '/en' ? englishLandingMarkdown(data) : page ? institutionalMarkdown(page) : home ? landingMarkdown(data) : NOT_FOUND_MARKDOWN;
    // No render cost is needed for agents requesting Markdown.
    const wantsMarkdown = req.accepts(['text/html', 'text/markdown']) === 'text/markdown';
    if ((home || page || notFound) && wantsMarkdown) {
      return sendPublicPage(req, res, { html: '', markdown, status: notFound ? 404 : 200, canonical });
    }
    const html = await options.html(req, data, home, notFound);
    if (home || page || notFound) return sendPublicPage(req, res, { html, markdown, status: notFound ? 404 : 200, canonical });
    return res.type('html').send(html);
  });
  return router;
}
