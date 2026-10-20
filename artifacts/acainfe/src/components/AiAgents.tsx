import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { ApiError } from '../lib/api';
import { createMcpKey, getMcpConnection, type GeneratedMcpKey } from '../lib/mcp-keys';
import { McpKeysSection } from './McpKeysSection';
import { McpConnectionGuide } from './McpConnectionGuide';
import { GeneratedKeyCard } from './GeneratedKeyCard';
import { Field } from './FieldLabel';
import '../mcp-keys.css';
import '../ai-agents.css';

type Connection = Awaited<ReturnType<typeof getMcpConnection>>;

export function AiAgents({ base, onUnauthorized }: { base: string; onUnauthorized: (error: ApiError) => void }) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [connError, setConnError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [pasted, setPasted] = useState('');
  const [generated, setGenerated] = useState<GeneratedMcpKey | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [genError, setGenError] = useState('');
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    let alive = true;
    setConnection(null); setConnError('');
    getMcpConnection(base).then(c => { if (alive) setConnection(c); }).catch(e => {
      if (!alive) return;
      if (e instanceof ApiError && e.status === 401) onUnauthorized(e);
      setConnError(e instanceof Error ? e.message : 'Não foi possível carregar as instruções.');
    });
    return () => { alive = false; };
  }, [base, attempt]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function generate() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setGenError('');
    try {
      const result = await createMcpKey(base, label);
      if (!mounted.current) return;
      setGenerated(result); setLabel(''); setRevision(r => r + 1);
    } catch (e) {
      if (!mounted.current) return;
      if (e instanceof ApiError && e.status === 401) onUnauthorized(e);
      setGenError(e instanceof Error ? e.message : 'Não foi possível gerar a chave.');
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  function revoked(ids?: string[]) {
    setGenerated(current => current && (!ids || !current.key || ids.includes(current.key.id)) ? null : current);
    setPasted('');
  }

  return <section className="app-card ai-agents">
    <span className="app-eyebrow">AGENTES DE IA</span>
    <h1>Seu assistente,<br />conectado.</h1>

    <section className="ai-block" aria-labelledby="ai-connect">
      <h2 id="ai-connect">Como conectar</h2>
      <p>Guardou a chave? Use estes comandos, não precisa gerar outra. Perdeu a chave? Gere uma nova abaixo e revogue a antiga.</p>
      {connError && <div className="app-alert" role="alert"><div>{connError}<button type="button" onClick={() => setAttempt(a => a + 1)}>Tentar novamente</button></div></div>}
      {!connection && !connError && <div className="mcp-keys-skeleton" aria-busy="true"><i /><i /></div>}
      {connection && <McpConnectionGuide connection={connection} pastedKey={pasted} onPastedKey={setPasted} />}
    </section>

    <div className="ai-block">
      <McpKeysSection base={base} variant="agents" refreshToken={revision} onUnauthorized={onUnauthorized}
        onGenerate={() => {}} onRevoked={revoked} />
    </div>

    <section className="ai-block" aria-labelledby="ai-generate">
      <h2 id="ai-generate">Gerar nova chave</h2>
      <p>A chave completa aparece uma única vez, logo depois de gerada.</p>
      {genError && <div className="app-alert" role="alert"><div>{genError}</div></div>}
      <Field label="Nome da chave (opcional)" help="Até 60 caracteres. Exemplo: Claude Code do notebook."><input value={label} maxLength={60} disabled={busy} onChange={e => setLabel(e.target.value)} /></Field>
      <button type="button" className="app-primary" disabled={busy} onClick={() => void generate()}>{busy ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}Gerar chave</button>
      {generated && <GeneratedKeyCard generated={generated} />}
    </section>
  </section>;
}
