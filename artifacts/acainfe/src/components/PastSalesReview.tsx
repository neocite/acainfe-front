import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../lib/api';
import { brl } from '../config/pricing';
import { getPastSalesItems, ignorePastSales, markPastSales, periodLabel, type PastSale } from '../lib/past-sales';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';

type Filter = 'ALL' | 'AVAILABLE' | 'ALREADY_ISSUED' | 'IGNORED';
type IgnoreTarget = { ids: string[] } | { period: string };

export function PastSalesReview({ base, period, onChanged, onClose, onUnauthorized }: {
  base: string; period: string; onChanged: () => Promise<void>; onClose: () => void; onUnauthorized: (error: ApiError) => void;
}) {
  const [items, setItems] = useState<PastSale[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [ignoreTarget, setIgnoreTarget] = useState<IgnoreTarget | null>(null);
  const [reason, setReason] = useState('');
  const seq = useRef(0);
  const lock = useRef(false);
  function report(e: unknown) {
    setError(e instanceof Error ? e.message : 'Não foi possível revisar as vendas.');
    if (e instanceof ApiError && e.status === 401) onUnauthorized(e);
  }
  const status = filter === 'ALL' ? undefined : filter;
  async function fetchItems() {
    const n = ++seq.current;
    const data = await getPastSalesItems(base, period, status);
    if (n === seq.current) setItems(data);
  }
  useEffect(() => {
    setLoading(true); setError('');
    let active = true;
    fetchItems().catch(e => { if (active) report(e); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; seq.current++; };
  }, [base, period, filter]);
  async function act(fn: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setError('');
    try { await fn(); await Promise.all([fetchItems(), onChanged()]); } catch (e) { report(e); } finally { lock.current = false; setBusy(false); }
  }
  const mark = (target: { ids: string[] } | { period: string }, value: boolean) => act(() => markPastSales(base, target, value));
  const unignore = (target: IgnoreTarget) => act(() => ignorePastSales(base, target, false));
  async function confirmIgnore() {
    if (!ignoreTarget) return;
    const target = ignoreTarget; const text = reason.trim();
    setIgnoreTarget(null); setReason('');
    await act(() => ignorePastSales(base, target, true, text || undefined));
  }
  const label = (item: PastSale) => `${item.customer?.name || 'Cliente não identificado'}, ${brl(item.amountCents)}`;
  const isMonth = ignoreTarget && 'period' in ignoreTarget;
  return <section className="past-sales-review" aria-label={`Revisar vendas de ${periodLabel(period)}`}>
    <div className="past-sales-actions"><h3>Revisar vendas · {periodLabel(period)}</h3><button type="button" className="text-button" disabled={busy} onClick={onClose}>Fechar revisão</button></div>
    <p>Marque as vendas que já receberam nota em outro sistema para evitar emissão em duplicidade. Vendas que você não quer emitir podem ser ignoradas.</p>
    <div className="ps-ignored-bar">
      <button type="button" className="app-secondary" disabled={busy || loading || !!error} onClick={() => {
        if (window.confirm(`Marcar todas as vendas de ${periodLabel(period)} como já emitidas? Elas deixarão de entrar na emissão pelo açaínfe. Faça isso somente se as notas já foram emitidas em outro sistema.`)) void mark({ period }, true);
      }}>Marcar o mês inteiro como já emitido</button>
      <button type="button" className="app-secondary" disabled={busy || loading || !!error} onClick={() => { setReason(''); setIgnoreTarget({ period }); }}>Ignorar (não é venda) — mês inteiro</button>
      <button type="button" className="app-secondary" disabled={busy || loading || !!error} onClick={() => void unignore({ period })}>Desfazer ignorar do mês</button>
    </div>
    <label className="ps-filter">Mostrar
      <select value={filter} disabled={busy} onChange={e => setFilter(e.target.value as Filter)}>
        <option value="ALL">Todas</option><option value="AVAILABLE">Sem nota</option>
        <option value="ALREADY_ISSUED">Já emitidas</option><option value="IGNORED">Ignoradas</option>
      </select></label>
    {error && <div className="app-alert" role="alert">{error}<button type="button" className="text-button" disabled={busy} onClick={async () => {
      setBusy(true); setError(''); try { await fetchItems(); await onChanged(); } catch (e) { report(e); } finally { setBusy(false); }
    }}>Tentar novamente</button></div>}
    {loading ? <p role="status">Carregando vendas…</p> : <div className="past-sales-table-wrap"><table className="past-sales-table">
      <thead><tr><th>Data</th><th>Cliente</th><th>Valor</th><th>Já tem nota em outro sistema</th><th>Ignorar</th></tr></thead>
      <tbody>{items.map(item => {
        const ignored = item.status === 'IGNORED';
        const issued = item.status === 'ALREADY_ISSUED';
        return <tr key={item.id}>
          <td>{new Date(item.paidAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
          <td>{item.customer?.name || 'Cliente não identificado'}</td><td>{brl(item.amountCents)}</td>
          <td>{ignored ? <span>Ignorada{item.ignoredReason ? `: ${item.ignoredReason}` : ''}</span> :
            <input type="checkbox" checked={issued} disabled={busy}
              aria-label={`Já tem nota em outro sistema: ${label(item)}`}
              onChange={event => void mark({ ids: [item.id] }, event.target.checked)} />}</td>
          <td>{ignored
            ? <button type="button" className="text-button" disabled={busy} onClick={() => void unignore({ ids: [item.id] })}>Desfazer</button>
            : issued
              ? <small>Desfaça &quot;já emitida&quot; antes</small>
              : <button type="button" className="text-button" disabled={busy} aria-label={`Ignorar venda: ${label(item)}`} onClick={() => { setReason(''); setIgnoreTarget({ ids: [item.id] }); }}>Ignorar (não é venda)</button>}</td>
        </tr>;
      })}</tbody>
    </table>{items.length === 0 && <p>Nenhuma venda neste filtro para o mês.</p>}</div>}
    <Dialog open={!!ignoreTarget} onOpenChange={open => { if (!open) setIgnoreTarget(null); }}>
      <DialogContent className="company-recommendation-dialog">
        <DialogTitle>{isMonth ? `Ignorar todas as vendas de ${periodLabel(period)}?` : 'Ignorar esta venda?'}</DialogTitle>
        <DialogDescription>Vendas ignoradas não entram na emissão. Você pode desfazer depois.</DialogDescription>
        <label className="app-field">Motivo (opcional)
          <textarea className="ps-reason" value={reason} placeholder="Ex.: pagamento de teste" onChange={e => setReason(e.target.value)} /></label>
        <div className="form-actions">
          <button type="button" className="app-secondary" onClick={() => setIgnoreTarget(null)}>Cancelar</button>
          <button type="button" className="app-primary" onClick={() => void confirmIgnore()}>Confirmar</button>
        </div>
      </DialogContent>
    </Dialog>
  </section>;
}
