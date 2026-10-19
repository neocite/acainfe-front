import * as React from 'react';
import { useState, type FormEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { AbacatePayKeyGuide } from './AbacatePayKeyGuide';
import { api, ApiError } from '../lib/api';
import type { AbacatePayConnection } from '../lib/past-sales';

export function AbacatePayConnectionDialog({ base, onClose, onConnected, onUnauthorized }: {
  base: string; onClose: () => void; onConnected: (connection: AbacatePayConnection) => void; onUnauthorized: (error: ApiError) => void;
}) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!key.trim()) { setError('Cole a nova API key do AbacatePay.'); return; }
    setBusy(true); setError('');
    try {
      const connection = await api<AbacatePayConnection>(`${base}/abacatepay`, 'POST', { apiKey: key.trim() });
      setKey('');
      onConnected(connection);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível atualizar a chave.');
      if (e instanceof ApiError && e.status === 401) onUnauthorized(e);
    } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="company-recommendation-dialog abacatepay-connection-dialog">
      <DialogTitle>Atualizar key do AbacatePay</DialogTitle>
      <DialogDescription>Reconectar com uma nova chave não cria outro webhook nem altera o que já funciona. Inclua as permissões de leitura das vendas passadas.</DialogDescription>
      <a href="https://app.abacatepay.com" className="external-link" target="_blank" rel="noreferrer">Abrir painel do AbacatePay <ExternalLink size={15} /></a>
      <AbacatePayKeyGuide />
      <form onSubmit={save}>
        <label className="app-field"><span>Nova API key do AbacatePay</span><input type="password" required autoComplete="off" value={key} disabled={busy} onChange={event => setKey(event.target.value)} /></label>
        {error && <p className="danger-text" role="alert">{error}</p>}
        <div className="past-sales-actions"><button className="app-secondary" type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="app-primary" type="submit" disabled={busy}>{busy ? 'Atualizando…' : 'Atualizar key'}</button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
