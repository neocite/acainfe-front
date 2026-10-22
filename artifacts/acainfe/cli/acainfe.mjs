#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const HELP = `açaínfe CLI 0.1.0 — Node.js 22+

Uso: node acainfe.mjs <comando>

  pricing                         Preço vigente (sem chave)
  coverage                        Cidades atendidas (sem chave)
  openapi                         Especificação pública (sem chave)
  mcp-config                      Exemplo de configuração MCP (sem chave)
  products list                   Listar produtos
  products create --file produto.json --confirm
  invoices list                   Listar notas
  invoices get <id>               Consultar uma nota
  invoices cancel <id> --file motivo.json --confirm
  sales create --file venda.json --confirm

Autenticação: variável ACAINFE_API_KEY, com uma chave de Agentes de IA.
Não passe chaves por argumento. A CLI não grava nem imprime a chave.
Saída JSON em stdout; erros em stderr; códigos de saída 0 (sucesso) e 1 (erro).
Não há repetição automática de pedidos. Escritas exigem --confirm.
`;

const commands = {
  pricing: { words: 1, path: '/v1/public/pricing', public: true },
  coverage: { words: 1, path: '/v1/public/coverage', public: true },
  openapi: { words: 1, path: '/openapi.json', public: true, website: true },
  'mcp-config': { words: 1, path: '/mcp.json', public: true, website: true },
  'products list': { words: 2, path: '/v1/products' },
  'products create': { words: 2, path: '/v1/products', write: true },
  'invoices list': { words: 2, path: '/v1/invoices' },
  'invoices get': { words: 2, path: '/v1/invoices', id: true },
  'invoices cancel': { words: 2, path: '/v1/invoices', id: true, suffix: '/cancel', write: true },
  'sales create': { words: 2, path: '/v1/sales', write: true },
};

/**
 * All I/O is injectable so tests never contact real companies or production APIs.
 * Credentials go only to the fixed API origin, never the website or a redirect.
 */
export async function run(argv, io = {}) {
  const env = io.env ?? process.env;
  const request = io.fetch ?? globalThis.fetch;
  const load = io.readFile ?? readFile;
  const out = io.out ?? (text => process.stdout.write(text + '\n'));
  const err = io.err ?? (text => process.stderr.write(text + '\n'));
  const key = env.ACAINFE_API_KEY ?? '';
  const redact = text => {
    let result = String(text);
    for (const secret of new Set([key, encodeURIComponent(key)].filter(Boolean))) result = result.split(secret).join('[REDACTED]');
    return result;
  };
  try {
    if (!argv.length || (argv.length === 1 && ['help', '--help', '-h'].includes(argv[0]))) { out(HELP); return 0; }
    if (argv.length === 1 && argv[0] === '--version') { out('0.1.0'); return 0; }
    const cmd = commands[argv.slice(0, 2).join(' ')] ?? commands[argv[0]];
    if (!cmd) throw new Error('Comando inválido. Use --help.');
    const args = argv.slice(cmd.words);
    let path = cmd.path;
    if (cmd.id) {
      const id = args.shift();
      if (!id || id.startsWith('--') || id === '.' || id === '..') throw new Error('Informe o identificador da nota.');
      path += '/' + encodeURIComponent(id) + (cmd.suffix ?? '');
    }
    let file, confirmed = false;
    while (args.length) {
      const option = args.shift();
      if (option === '--confirm' && !confirmed) confirmed = true;
      else if (option === '--file' && !file && args[0] && !args[0].startsWith('--')) file = args.shift();
      else throw new Error('Argumentos inválidos. Use --help. Chaves não são aceitas por argumento.');
    }
    if (cmd.write && (!confirmed || !file)) throw new Error('Esta ação exige --file com um JSON e --confirm. Nada foi enviado.');
    if (!cmd.write && (confirmed || file)) throw new Error('Este comando não aceita --file nem --confirm.');
    if (!cmd.public && !key.trim()) throw new Error('Defina ACAINFE_API_KEY com uma chave gerada em Agentes de IA.');
    let payload;
    if (cmd.write) {
      const raw = await load(file, 'utf8');
      if (Buffer.byteLength(raw) > 1024 * 1024) throw new Error('O JSON deve ter no máximo 1 MB.');
      let parsed;
      try { parsed = JSON.parse(raw); } catch { throw new Error('Arquivo JSON inválido. Nada foi enviado.'); }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('O corpo precisa ser um objeto JSON.');
      if (Object.hasOwn(parsed, 'apiKey') || Object.hasOwn(parsed, 'authorization')) throw new Error('Não inclua credenciais no corpo JSON.');
      payload = JSON.stringify(parsed);
    }
    const headers = { Accept: 'application/json' };
    if (!cmd.public) headers['x-api-key'] = key;
    if (payload) headers['Content-Type'] = 'application/json';
    const response = await request((cmd.website ? 'https://acainfe.com' : 'https://api.acainfe.com') + path, {
      method: cmd.write ? 'POST' : 'GET', headers, body: payload,
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    if (!response.ok) {
      let message = 'A API recusou o pedido.';
      try { const body = JSON.parse(text); if (typeof body.message === 'string') message = body.message; } catch { /* No raw HTML, headers or upstream traces in logs. */ }
      throw new Error(`HTTP ${response.status}: ${message}`);
    }
    let result;
    try { result = JSON.parse(text); } catch { throw new Error('A API não devolveu JSON válido.'); }
    out(redact(JSON.stringify(result, null, 2)));
    return 0;
  } catch (error) {
    err(redact(error instanceof Error ? error.message : 'Não foi possível concluir o pedido.'));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run(process.argv.slice(2));
}
