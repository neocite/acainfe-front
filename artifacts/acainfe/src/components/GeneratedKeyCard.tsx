import * as React from 'react';
import { Field } from './FieldLabel';
import { CopyButton } from './CopyButton';
import { McpConnectionGuide } from './McpConnectionGuide';
import type { GeneratedMcpKey } from '../lib/mcp-keys';

export function GeneratedKeyCard({ generated }: { generated: GeneratedMcpKey }) {
  const config = (generated as GeneratedMcpKey & { jsonConfig?: unknown }).jsonConfig;
  return <div className="generated-key">
    <div className="app-notice"><strong>Guarde agora: ela não aparece de novo.</strong><p>Não compartilhe sua chave nem capturas desta tela. Ela não é salva no navegador.</p></div>
    <Field label="Sua chave MCP"><div className="copy-field"><code>{generated.apiKey}</code><CopyButton text={generated.apiKey} /></div></Field>
    <Field label="URL do servidor MCP"><div className="copy-field"><code>{generated.mcpUrl}</code><CopyButton text={generated.mcpUrl} /></div></Field>
    <McpConnectionGuide generated connection={{
      mcpUrl: generated.mcpUrl,
      claudeCodeCommand: generated.claudeCodeCommand,
      authorizationHeader: `Authorization: Bearer ${generated.apiKey}`,
      jsonConfig: config,
    }} />
  </div>;
}
