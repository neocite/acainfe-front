import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { ApiError } from '../lib/api';
import { listMcpKeys, revokeMcpKey, revokeAllMcpKeys, type McpKeyItem } from '../lib/mcp-keys';

type Props = {
  base: string;
  variant?: 'panel' | 'onboarding' | 'agents';
  refreshToken?: number;
  onUnauthorized: (error: ApiError) => void;
  onGenerate: () => void;
  onRevoked: (ids?: string[]) => void;
};

const pad = (n: number) => String(n).padStart(2, '0');
function fmtDate(value?: string | null, time = false) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Data inválida';
  const day = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return time ? `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}` : day;
}
const origins: Record<string, string> = { APP: 'Painel', API: 'API', ADMIN: 'Administração' };
const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);
const labelOf = (k: McpKeyItem) => k.label?.trim() || (k.last4 ? `…${k.last4}` : k.legacy ? 'Chave antiga' : 'Sem nome');

export function McpKeysSection({ base, variant = 'panel', refreshToken, onUnauthorized, onGenerate, onRevoked }: Props) {
  const embedded = variant === 'onboarding';
  const agents = variant === 'agents';
  const [items, setItems] = useState<McpKeyItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<McpKeyItem | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const lock = useRef(false);
  const seq = useRef(0);
  const mounted = useRef(false);
  const unauthRef = useRef(onUnauthorized);
  unauthRef.current = onUnauthorized;
  const revokedRef = useRef(onRevoked);
  revokedRef.current = onRevoked;

  const load = useCallback(async (silent: boolean): Promise<boolean> => {
    const id = ++seq.current;
    if (!silent) { setStatus('loading'); setLoadError(''); }
    try {
      const list = await listMcpKeys(base);
      if (id !== seq.current) return false;
      setItems(list); setStatus('ready'); setLoadError(''); setRefreshError('');
      return true;
    } catch (e) {
      if (id !== seq.current) return false;
      if (e instanceof ApiError && e.status === 401) { unauthRef.current(e); }
      const msg = errMsg(e, 'Não foi possível carregar as chaves.');
      if (silent) setRefreshError(msg); else { setLoadError(msg); setStatus('error'); }
      return false;
    }
  }, [base]);

  useEffect(() => {
    mounted.current = true;
    setItems([]); setMessage(''); setRefreshError('');
    void load(false);
    return () => { mounted.current = false; seq.current++; };
  }, [load, refreshToken]);

  function closeDialogs() {
    if (lock.current) return;
    setTarget(null); setAllOpen(false); setConfirmText(''); setDialogError('');
  }

  async function confirmOne() {
    if (!target || lock.current) return;
    const id = target.id;
    lock.current = true; setBusy(true); setDialogError('');
    try {
      await revokeMcpKey(base, id);
    } catch (e) {
      if (!mounted.current) return;
      if (e instanceof ApiError && e.status === 401) { lock.current = false; setBusy(false); setTarget(null); unauthRef.current(e); return; }
      setDialogError(errMsg(e, 'Não foi possível revogar a chave.'));
      lock.current = false; setBusy(false);
      return;
    }
    if (!mounted.current) return;
    setItems(prev => prev.filter(k => k.id !== id));
    setMessage('Chave revogada'); setTarget(null); setDialogError('');
    lock.current = false; setBusy(false);
    revokedRef.current([id]);
    void load(true);
  }

  async function confirmAll() {
    if (confirmText !== 'REVOGAR' || lock.current) return;
    lock.current = true; setBusy(true); setDialogError('');
    try {
      await revokeAllMcpKeys(base);
    } catch (e) {
      if (!mounted.current) return;
      if (e instanceof ApiError && e.status === 401) { lock.current = false; setBusy(false); setAllOpen(false); unauthRef.current(e); return; }
      setDialogError(errMsg(e, 'Não foi possível revogar as chaves.'));
      lock.current = false; setBusy(false);
      return;
    }
    if (!mounted.current) return;
    setItems([]); setMessage('Todas as chaves foram revogadas');
    setAllOpen(false); setConfirmText(''); setDialogError('');
    lock.current = false; setBusy(false);
    revokedRef.current();
    void load(true);
  }

  return <section className={`mcp-keys${embedded ? ' mcp-keys--onboarding' : agents ? ' mcp-keys--agents' : ''}`} aria-labelledby="mcp-keys-title">
    <div className="mcp-keys-head">
      <div>
        {!embedded && !agents && <span className="mcp-keys-eyebrow">ASSISTENTE DE IA</span>}
        <h3 id="mcp-keys-title">{embedded || agents ? 'Chaves ativas' : 'Chaves do MCP'}</h3>
        <p>A lista nunca mostra a chave completa, apenas os últimos 4 caracteres. A chave inteira aparece uma única vez, quando é gerada.</p>
      </div>
      <div className="mcp-keys-actions">
        {(embedded || agents) && <button type="button" className="app-secondary" disabled={busy || status === 'loading'} onClick={() => void load(false)}>Atualizar</button>}
        {!embedded && !agents && <button type="button" className="app-secondary mcp-keys-generate" disabled={busy} onClick={onGenerate}>Gerar nova chave</button>}
      </div>
    </div>

    {message && <p className="mcp-keys-status" role="status">{message}</p>}
    {refreshError && <div className="mcp-keys-warn" role="alert">
      <span>Não foi possível atualizar a lista agora: {refreshError}</span>
      <button type="button" onClick={() => void load(true)}>Tentar novamente</button>
    </div>}

    {status === 'loading' && <div className="mcp-keys-skeleton" aria-busy="true" role="status"><span className="sr-only">Carregando chaves…</span><i /><i /></div>}
    {status === 'error' && <div className="app-alert" role="alert">
      <div><span>{loadError}</span><button type="button" onClick={() => void load(false)}>Tentar novamente</button></div>
    </div>}
    {status === 'ready' && items.length === 0 && <div className="mcp-keys-empty">
      <strong>Nenhuma chave ativa</strong>
      <p>{agents ? 'Gere uma chave abaixo para conectar o agente.' : embedded ? 'Gere uma acima para conectar o assistente.' : 'Nenhum agente de IA consegue usar o MCP agora. Gere uma chave para conectar.'}</p>
      {!embedded && !agents && <button type="button" className="app-primary" onClick={onGenerate}>Gerar nova chave</button>}
    </div>}
    {status === 'ready' && items.length > 0 && <>
      <ul className="mcp-keys-list">
        {items.map(k => {
          const created = fmtDate(k.createdAt);
          const used = fmtDate(k.lastUsedAt, true);
          return <li key={k.id} className="mcp-key-row">
            {k.legacy ? <>
              <div className="mcp-key-main">
                <strong>{k.last4 || k.lastUsedAt ? 'Chave antiga' : 'Chave antiga (sem detalhes)'}</strong>
                {k.last4 && <code aria-label={`Termina em ${k.last4}`}>…{k.last4}</code>}
                {!k.last4 && !k.lastUsedAt && <small className="mcp-key-legacy-help">Ainda não foi usada desde o registro de chaves. Se nenhum agente de IA estiver usando, pode revogar.</small>}
              </div>
              {k.lastUsedAt && <dl className="mcp-key-meta"><div><dt>Último uso</dt><dd>{used}</dd></div></dl>}
            </> : <>
              <div className="mcp-key-main">
                <strong>{k.label?.trim() || 'Sem nome'}</strong>
                {k.last4 && <code aria-label={`Termina em ${k.last4}`}>…{k.last4}</code>}
                {k.createdVia && origins[k.createdVia] && <span className="mcp-key-origin">{origins[k.createdVia]}</span>}
              </div>
              <dl className="mcp-key-meta">
                <div><dt>Criada em</dt><dd>{created || 'Não informada'}</dd></div>
                <div><dt>Último uso</dt><dd>{used || 'Nunca usada'}</dd></div>
              </dl>
            </>}
            <button type="button" className="mcp-key-revoke" disabled={busy}
              aria-label={`Revogar ${k.legacy ? `chave antiga${k.last4 ? ` …${k.last4}` : ''}` : labelOf(k)}`}
              onClick={() => { setMessage(''); setDialogError(''); setTarget(k); }}>Revogar</button>
          </li>;
        })}
      </ul>
      <p className="mcp-keys-help">Para descobrir qual chave antiga está em uso, use o MCP uma vez e clique em {embedded || agents ? 'Atualizar' : 'Atualizar status'}: a chave usada passa a mostrar o final e o último uso.</p>
      <button type="button" className="app-secondary mcp-keys-revoke-all" disabled={busy}
        onClick={() => { setMessage(''); setDialogError(''); setConfirmText(''); setAllOpen(true); }}>Revogar todas as chaves</button>
    </>}

    <Dialog open={!!target} onOpenChange={open => { if (!open) closeDialogs(); }}>
      <DialogContent className="mcp-keys-dialog" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}>
        <DialogTitle>Revogar chave</DialogTitle>
        <DialogDescription>
          Revogar a chave {target ? labelOf(target) : ''}? Qualquer agente de IA ou integração usando essa chave para de funcionar na hora. Não dá para desfazer.
        </DialogDescription>
        {dialogError && <p className="danger-text" role="alert">{dialogError}</p>}
        <div className="mcp-keys-dialog-actions">
          <button type="button" className="app-secondary" disabled={busy} onClick={closeDialogs}>Cancelar</button>
          <button type="button" className="mcp-danger" disabled={busy} onClick={() => void confirmOne()}>{busy ? 'Revogando…' : 'Revogar chave'}</button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={allOpen} onOpenChange={open => { if (!open) closeDialogs(); }}>
      <DialogContent className="mcp-keys-dialog" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onInteractOutside={e => { if (busy) e.preventDefault(); }}>
        <DialogTitle>Revogar todas as chaves</DialogTitle>
        <DialogDescription>
          Todas as chaves serão revogadas. O MCP para de funcionar em todos os agentes e integrações até você gerar uma nova chave. Não dá para desfazer.
        </DialogDescription>
        <label className="app-field" htmlFor="mcp-revoke-all-confirm">
          <span>Digite REVOGAR para confirmar</span>
          <input id="mcp-revoke-all-confirm" value={confirmText} autoComplete="off" disabled={busy}
            onChange={e => setConfirmText(e.target.value)} />
        </label>
        {dialogError && <p className="danger-text" role="alert">{dialogError}</p>}
        <div className="mcp-keys-dialog-actions">
          <button type="button" className="app-secondary" disabled={busy} onClick={closeDialogs}>Cancelar</button>
          <button type="button" className="mcp-danger" disabled={busy || confirmText !== 'REVOGAR'} onClick={() => void confirmAll()}>{busy ? 'Revogando…' : 'Revogar todas'}</button>
        </div>
      </DialogContent>
    </Dialog>
  </section>;
}

export default McpKeysSection;
