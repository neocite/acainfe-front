import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { ApiError } from '../lib/api';
import { createMcpKey, listMcpKeys, type GeneratedMcpKey } from '../lib/mcp-keys';
import { GeneratedKeyCard } from './GeneratedKeyCard';
import { CopyButton } from './CopyButton';
import { Field } from './FieldLabel';
import '../ai-agents.css';

type Props = {
  base: string;
  products: number;
  onDone: () => void;
  onManage: () => void;
  onUnauthorized: (error: ApiError) => void;
  onKeyCreated?: () => void;
};

export function OnboardingAssistant({ base, products, onDone, onManage, onUnauthorized, onKeyCreated }: Props) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hasKeys, setHasKeys] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [generated, setGenerated] = useState<GeneratedMcpKey | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    let alive = true;
    setState('loading'); setLoadError('');
    listMcpKeys(base).then(items => { if (alive) { setHasKeys(items.length > 0); setState('ready'); } }).catch(e => {
      if (!alive) return;
      if (e instanceof ApiError && e.status === 401) onUnauthorized(e);
      setLoadError(e instanceof Error ? e.message : 'Não foi possível verificar suas chaves.'); setState('error');
    });
    return () => { alive = false; };
  }, [base, attempt]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function generate() {
    if (lock.current || state !== 'ready' || hasKeys || generated) return;
    lock.current = true;
    setBusy(true); setError('');
    try {
      const result = await createMcpKey(base, label);
      if (!mounted.current) return;
      setGenerated(result); setLabel('');
      onKeyCreated?.();
    }
    catch (e) {
      if (!mounted.current) return;
      if (e instanceof ApiError && e.status === 401) onUnauthorized(e);
      setError(e instanceof Error ? e.message : 'Não foi possível gerar a chave.');
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  return <>
    <div className="step-icon"><Sparkles /></div><h2>Seu assistente<br />assume daqui.</h2>
    <p>Emita, consulte, reenvie e cancele notas conversando. Conecte o açaínfe ao Claude ou a outro cliente MCP.</p>
    {products > 0 && <div className="app-notice">{products} produtos aguardam a definição do código de serviço. O assistente te ajuda no próximo passo.</div>}
    {state === 'loading' && <div className="mcp-keys-skeleton" aria-busy="true"><i /></div>}
    {state === 'error' && <div className="app-alert" role="alert"><div>{loadError}<button type="button" onClick={() => setAttempt(a => a + 1)}>Tentar novamente</button></div></div>}
    {error && <div className="app-alert" role="alert"><div>{error}</div></div>}
    {state === 'ready' && !generated && (hasKeys
      ? <div className="app-notice"><strong>Você já tem uma chave.</strong><p>Gerencie em Agentes de IA.</p><button type="button" className="app-secondary" disabled={busy} onClick={onManage}>Agentes de IA</button></div>
      : <><Field label="Nome da chave (opcional)" help="Até 60 caracteres. Exemplo: Claude Code do notebook."><input value={label} maxLength={60} disabled={busy} onChange={e => setLabel(e.target.value)} /></Field>
        <button type="button" className="app-primary" disabled={busy} onClick={() => void generate()}>{busy ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}Gerar minha chave</button></>)}
    {generated && <>
      <GeneratedKeyCard generated={generated} />
      <div className="first-prompt"><Sparkles size={19} /><div><strong>Sua primeira conversa</strong><p>Use o prompt <code>configurar_empresa</code> ou diga: “quero definir a tributação dos meus produtos”.</p><CopyButton text="quero definir a tributação dos meus produtos" /></div></div>
    </>}
    <button type="button" className="app-primary" disabled={busy} onClick={() => { setGenerated(null); onDone(); }}>Concluir <ArrowRight size={18} /></button>
  </>;
}
