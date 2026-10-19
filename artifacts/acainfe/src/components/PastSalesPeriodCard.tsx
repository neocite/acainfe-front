import * as React from 'react';
import { brl } from '../config/pricing';
import { periodLabel, type PastSalesPeriod, type PastSalesResult, type SaleProduct } from '../lib/past-sales';

export function PastSalesPeriodCard({
  period, price, products, fallback, busy, result, onFallback, onReview, onIssue,
}: {
  period: PastSalesPeriod; price: number | null; products: SaleProduct[]; fallback: string;
  busy: boolean; result?: PastSalesResult; onFallback: (id: string) => void;
  onReview: () => void; onIssue: () => void;
}) {
  const available = period.available;
  const excluded = [
    period.alreadyIssued > 0 && `${period.alreadyIssued} já emitidas em outro sistema`,
    period.imported > 0 && `${period.imported} já importadas`,
    period.refunded > 0 && `${period.refunded} estornadas (não entram)`,
  ].filter(Boolean);
  return <article className="past-sales-period">
    <div className="past-sales-period-heading"><h3>{periodLabel(period.period)}</h3><span>{period.isCurrentMonth ? 'Mês atual' : 'Mês anterior'}</span></div>
    <p><strong>{available.count} vendas</strong> sem nota · {brl(available.totalCents)}</p>
    <p className="past-sales-cost">{price === null ? 'Carregando custo da emissão…' : `Emitir ${available.count} notas custa ${brl(available.count * price)}`}</p>
    {excluded.length > 0 && <small>{excluded.join(' · ')}</small>}
    {available.withoutItems > 0 && <label className="app-field">
      <span>{available.withoutItems} vendas por Pix avulso sem produto. Escolha um produto para elas.</span>
      <select value={fallback} onChange={event => onFallback(event.target.value)} disabled={busy}>
        <option value="">Selecione um produto</option>
        {products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
      </select>
    </label>}
    {period.requiresConfirmation && available.count > 0 && <p className="past-sales-period-note">A emissão deste mês exige confirmação sobre competência e possível retificação do PGDAS.</p>}
    {result && <div className="past-sales-result" role="status">
      <p>{result.issued} notas entrando na fila de emissão.</p>
      {result.held > 0 && <p>{result.held} aguardam você definir a tributação do produto no assistente; saem automaticamente depois.</p>}
      {result.skippedWithoutProduct > 0 && <p>{result.skippedWithoutProduct} vendas não foram importadas por falta de produto. Escolha um produto e atualize a lista antes de tentar novamente.</p>}
      {result.failed.length > 0 && <ul className="danger-text">{result.failed.map((failure, index) => <li key={index}>{failure.message}</li>)}</ul>}
    </div>}
    <div className="past-sales-actions">
      <button type="button" className="app-secondary" disabled={busy} onClick={onReview}>Revisar vendas</button>
      <button type="button" className="app-primary" disabled={busy || available.count === 0 || price === null || (available.withoutItems > 0 && !fallback)} onClick={onIssue}>Emitir {available.count} notas</button>
    </div>
  </article>;
}
