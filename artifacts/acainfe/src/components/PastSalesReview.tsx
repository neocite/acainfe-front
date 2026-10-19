import * as React from 'react';
import { useEffect, useState } from 'react';
import { ApiError } from '../lib/api';
import { brl } from '../config/pricing';
import { getPastSalesItems, markPastSales, periodLabel, type PastSale } from '../lib/past-sales';

export function PastSalesReview({ base, period, onChanged, onClose, onUnauthorized }: {
  base: string; period: string; onChanged: () => Promise<void>; onClose: () => void; onUnauthorized: (error: ApiError) => void;
}) {
  const [items, setItems] = useState<PastSale[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  function report(e: unknown) {
    setError(e instanceof Error ? e.message : 'Não foi possível revisar as vendas.');
    if (e instanceof ApiError && e.status === 401) onUnauthorized(e);
  }
  async function reload() { setItems(await getPastSalesItems(base, period)); }
  useEffect(() => {
    let mounted = true;
    getPastSalesItems(base, period).then(data => { if (mounted) setItems(data); })
      .catch(e => { if (mounted) report(e); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [base, period]);
  async function mark(target: { ids: string[] } | { period: string }, value: boolean) {
    setBusy(true); setError('');
    try {
      await markPastSales(base, target, value);
      await Promise.all([reload(), onChanged()]);
    } catch (e) { report(e); } finally { setBusy(false); }
  }
  return <section className="past-sales-review" aria-label={`Revisar vendas de ${periodLabel(period)}`}>
    <div className="past-sales-actions"><h3>Revisar vendas · {periodLabel(period)}</h3><button type="button" className="text-button" disabled={busy} onClick={onClose}>Fechar revisão</button></div>
    <p>Marque as vendas que já receberam nota em outro sistema para evitar emissão em duplicidade.</p>
    <button type="button" className="app-secondary" disabled={busy || loading || !!error} onClick={() => {
      if (window.confirm(`Marcar todas as vendas de ${periodLabel(period)} como já emitidas? Elas deixarão de entrar na emissão pelo açaínfe. Faça isso somente se as notas já foram emitidas em outro sistema.`)) void mark({ period }, true);
    }}>Marcar o mês inteiro como já emitido</button>
    {error && <div className="app-alert" role="alert">{error}<button type="button" className="text-button" disabled={busy} onClick={async () => {
      setBusy(true); setError(''); try { await reload(); await onChanged(); } catch (e) { report(e); } finally { setBusy(false); }
    }}>Tentar novamente</button></div>}
    {loading ? <p role="status">Carregando vendas…</p> : <div className="past-sales-table-wrap"><table className="past-sales-table">
      <thead><tr><th>Data</th><th>Cliente</th><th>Valor</th><th>Já tem nota em outro sistema</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.id}>
        <td>{new Date(item.paidAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
        <td>{item.customer?.name || 'Cliente não identificado'}</td><td>{brl(item.amountCents)}</td>
        <td><input type="checkbox" checked={item.status === 'ALREADY_ISSUED'} disabled={busy}
          aria-label={`Já tem nota em outro sistema: ${item.customer?.name || 'Cliente não identificado'}, ${brl(item.amountCents)}`}
          onChange={event => void mark({ ids: [item.id] }, event.target.checked)} /></td>
      </tr>)}</tbody>
    </table>{items.length === 0 && <p>Nenhuma venda disponível ou marcada como já emitida neste mês.</p>}</div>}
  </section>;
}
