import express from 'express';
import { readFile } from 'node:fs/promises';
import { publicOpenApi } from './public-api-schema';
import { cachedPublicDocument, type PublicDocumentOptions } from './cached-public-document';

export const publicMcpServerCard = {
  name: 'acainfe',
  title: 'açaínfe',
  transport: { type: 'streamable-http', url: 'https://api.acainfe.com/mcp' },
  authentication: { required: true, schemes: ['bearer'] },
  documentationUrl: 'https://acainfe.com/developers',
  instructionsUrl: 'https://acainfe.com/llms.txt',
  openapi: 'https://api.acainfe.com/openapi.json',
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function isPublicOpenApi(value: unknown) {
  return isObject(value) && typeof value.openapi === 'string' && value.openapi.startsWith('3.')
    && isObject(value.paths) && Object.keys(value.paths).length > 0
    && Object.keys(value.paths).every(path => path.startsWith('/')
      && !/\/(?:admin|app|webhooks)(?:\/|$)/i.test(path));
}

function isMcpServerCard(value: unknown) {
  return isObject(value) && typeof value.name === 'string'
    && isObject(value.transport) && value.transport.type === 'streamable-http'
    && value.transport.url === 'https://api.acainfe.com/mcp'
    && isObject(value.authentication) && value.authentication.required === true
    && Array.isArray(value.authentication.schemes) && value.authentication.schemes.includes('bearer');
}

export const publicMcpConfig = {
  mcpServers: {
    acainfe: { type: 'http', url: 'https://api.acainfe.com/mcp', headers: { Authorization: 'Bearer <SUA_CHAVE>' } },
  },
};
export const agentDiscoveryLinks = [
  '<https://acainfe.com/openapi.json>; rel="service-desc"; type="application/json"',
  '<https://acainfe.com/developers>; rel="service-doc"; type="text/html"',
  '<https://acainfe.com/agent-instructions.md>; rel="describedby"; type="text/markdown"',
];
export const agentDiscoveryHtml = [
  '<link rel="service-desc" type="application/json" href="https://acainfe.com/openapi.json" />',
  '<link rel="service-doc" type="text/html" href="https://acainfe.com/developers" />',
  '<link rel="describedby" type="text/markdown" href="https://acainfe.com/agent-instructions.md" />',
].join('\n');

const files = [
  { path: '/agent-instructions.md', file: '../content/agent-instructions.md', type: 'text/markdown; charset=utf-8' },
  { path: '/cli/acainfe.mjs', file: '../cli/acainfe.mjs', type: 'application/javascript; charset=utf-8' },
  { path: '/cli/README.md', file: '../cli/README.md', type: 'text/markdown; charset=utf-8' },
];

export async function createAgentResourcesRouter(options: PublicDocumentOptions = {}) {
  const router = express.Router();
  const now = options.now ?? Date.now;
  const remoteDocuments = [
    { path: '/openapi.json', fallback: publicOpenApi, valid: isPublicOpenApi },
    { path: '/.well-known/mcp.json', fallback: publicMcpServerCard, valid: isMcpServerCard },
  ].map(doc => ({
    ...doc, get: cachedPublicDocument(`https://api.acainfe.com${doc.path}`, doc.fallback, doc.valid, options),
  }));
  for (const doc of remoteDocuments) {
    router.get(doc.path, async (_req, res) => {
      const entry = await doc.get();
      res.set({
        'Cache-Control': 'public, max-age=3600',
        Age: String(Math.max(0, Math.floor((now() - entry.fetchedAt) / 1000))),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'If-None-Match',
        'Access-Control-Expose-Headers': 'ETag, Link, Age',
        'X-Content-Type-Options': 'nosniff',
      }).status(200).type('application/json; charset=utf-8').send(entry.content);
    });
    router.options(doc.path, (_req, res) => res.set({
      'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'If-None-Match',
    }).sendStatus(204));
  }
  const documents = [
    { path: '/mcp.json', type: 'application/json; charset=utf-8', content: JSON.stringify(publicMcpConfig) },
    ...await Promise.all(files.map(async file => ({ ...file, content: await readFile(new URL(file.file, import.meta.url), 'utf8') }))),
  ];
  for (const doc of documents) {
    router.route(doc.path)
      .all((_req, res, next) => {
        // Only public, immutable metadata/files. Never apply this CORS policy to app APIs.
        res.set({
          'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'If-None-Match',
          'Access-Control-Expose-Headers': 'ETag, Link',
          'X-Content-Type-Options': 'nosniff',
        });
        next();
      })
      .options((_req, res) => res.sendStatus(204))
      .get((_req, res) => res.set('Cache-Control', 'public, max-age=300').type(doc.type).send(doc.content));
  }
  return router;
}

export const agentResourcesRouter = await createAgentResourcesRouter();
