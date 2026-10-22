import express from 'express';
import { readFile } from 'node:fs/promises';
import { publicOpenApi } from './public-api-schema';

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

export async function createAgentResourcesRouter() {
  const router = express.Router();
  const documents = [
    { path: '/openapi.json', type: 'application/json; charset=utf-8', content: JSON.stringify(publicOpenApi) },
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
