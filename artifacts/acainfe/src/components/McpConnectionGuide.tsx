import * as React from 'react';
import { useState } from 'react';
import { CopyButton } from './CopyButton';
import { hermesMcpCommand } from '../lib/hermes-mcp';

export type GuideConnection = {
  mcpUrl: string;
  keyPlaceholder?: string;
  authorizationHeader?: string;
  claudeCodeCommand: string;
  jsonConfig?: unknown;
};

function substitute(value: unknown, placeholder: string, key: string): unknown {
  if (typeof value === 'string') return value.split(placeholder).join(key);
  if (Array.isArray(value)) return value.map(item => substitute(item, placeholder, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, substitute(v, placeholder, key)]));
  }
  return value;
}

export function configText(config: unknown, placeholder?: string, key?: string): string | null {
  if (config === undefined || config === null || config === '') return null;
  let value: unknown = config;
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { /* texto puro */ } }
  if (placeholder && key) value = substitute(value, placeholder, key);
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function plain(text: string, placeholder?: string, key?: string) {
  return placeholder && key ? text.split(placeholder).join(key) : text;
}

type Props = {
  connection: GuideConnection;
  /** Modo "chave recém-gerada": os comandos já vêm com a chave real. */
  generated?: boolean;
  pastedKey?: string;
  onPastedKey?: (value: string) => void;
};

export function McpConnectionGuide({ connection, generated, pastedKey = '', onPastedKey }: Props) {
  const [tab, setTab] = useState<'code' | 'json' | 'other' | 'hermes'>('code');
  const ph = generated ? undefined : connection.keyPlaceholder;
  const key = generated ? undefined : pastedKey.trim() || undefined;
  const command = plain(connection.claudeCodeCommand, ph, key);
  const url = plain(connection.mcpUrl, ph, key);
  const json = configText(connection.jsonConfig, ph, key);
  const header = connection.authorizationHeader ? plain(connection.authorizationHeader, ph, key) : null;
  const tabs: [typeof tab, string][] = [['code', 'Claude Code'], ['json', 'Arquivo de configuração (JSON)'], ['other', 'Outro cliente MCP'], ['hermes', 'Hermes (CLI)']];

  return <div className="mcp-guide">
    {onPastedKey && <label className="app-field mcp-guide-paste">
      <span>Cole sua chave para preencher os comandos (opcional)</span>
      <input type="password" autoComplete="off" spellCheck={false} value={pastedKey} placeholder="Sua chave MCP"
        onChange={e => onPastedKey(e.target.value)} />
      <small>A chave fica só no seu navegador. Ela não é enviada, salva nem registrada.</small>
    </label>}
    <div className="mcp-tabs" role="group" aria-label="Cliente MCP">
      {tabs.map(([id, label]) => <button key={id} type="button" aria-pressed={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}
    </div>
    {tab === 'code' && <><p>Cole este comando no terminal:</p><div className="copy-field command"><code>{command}</code><CopyButton text={command} /></div></>}
    {tab === 'json' && (json
      ? <><p>Adicione este trecho ao arquivo de configuração do seu cliente MCP:</p><div className="copy-field command"><code><pre>{json}</pre></code><CopyButton text={json} /></div></>
      : <div className="app-notice" role="alert"><strong>Configuração em JSON indisponível.</strong><p>O servidor não enviou esse modelo. Use a aba Claude Code ou Outro cliente MCP.</p></div>)}
    {tab === 'other' && <>
      <p>Adicione um servidor MCP remoto com transporte <strong>Streamable HTTP</strong>, esta URL e este header:</p>
      <div className="copy-field"><code>{url}</code><CopyButton text={url} /></div>
      {header ? <div className="copy-field"><code>{header}</code><CopyButton text={header} /></div> : <p className="app-muted">O servidor não enviou o header de autorização.</p>}
    </>}
    {tab === 'hermes' && <section aria-label="Conectar ao Hermes via CLI">
      <p>Com o Hermes Agent instalado, abra o terminal (Bash ou Zsh, no macOS/Linux).</p>
      <ol>
        <li><p>Adicione o servidor com autenticação por chave:</p><div className="copy-field command"><code>{hermesMcpCommand(connection.mcpUrl)}</code><CopyButton text={hermesMcpCommand(connection.mcpUrl)} /></div></li>
        <li><p>Quando aparecer <code>API key / Bearer token</code>, cole somente a chave, sem escrever <code>Bearer</code>. A entrada fica oculta.</p></li>
        <li><p>Teste a conexão:</p><div className="copy-field command"><code>hermes mcp test acainfe</code><CopyButton text="hermes mcp test acainfe" /></div></li>
      </ol>
      <p>O comando não inclui sua chave, para não deixá-la no histórico do terminal.</p>
      <a href="https://hermes-agent.nousresearch.com/docs/reference/cli-commands" target="_blank" rel="noopener noreferrer">Documentação oficial do Hermes</a>
    </section>}
  </div>;
}
