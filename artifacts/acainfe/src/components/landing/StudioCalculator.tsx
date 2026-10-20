import { useState } from 'react';
import { brl } from '@/config/pricing';

const presets = [
  { count: 12, title: 'Mês tranquilo' },
  { count: 48, title: 'Ritmo constante' },
  { count: 126, title: 'Mês de lançamento' },
];

export function StudioCalculator({ price, monthlyFee, invoices, onInvoicesChange, onCompare }: {
  price: number;
  monthlyFee: number;
  invoices: number;
  onInvoicesChange: (count: number) => void;
  onCompare: () => void;
}) {
  const [ticket, setTicket] = useState(197);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const total = invoices * price + monthlyFee;
  const revenue = invoices * Math.round(ticket * 100);
  const share = revenue > 0 ? total / revenue * 100 : 0;
  const progress = invoices / 200 * 100;

  return (
    <section className="csr-calculator" id="simulador" aria-labelledby="csr-calc-title">
      <span id="calculadora" className="csr-anchor" aria-hidden="true" />
      <div className="csr-calc-top">
        <div><span className="csr-label">SIMULADOR DE CUSTO</span><h2 id="csr-calc-title">Um mês na sua operação</h2></div>
        <span className="csr-calc-index">01 <i>—</i> 03</span>
      </div>
      <label className="csr-range-title" htmlFor="csr-invoices"><span>Notas emitidas</span><strong>{invoices}<small> / mês</small></strong></label>
      <input id="csr-invoices" className="csr-range" type="range" min="0" max="200" step="1"
        value={invoices} onChange={(event) => onInvoicesChange(Number(event.target.value))}
        style={{ backgroundImage: `linear-gradient(90deg, #8c4b79 ${progress}%, #e7dcd7 ${progress}%)` }}
        aria-label="Quantidade de notas emitidas por mês" />
      <div className="csr-range-ends"><span>0 notas</span><span>200 notas</span></div>
      <div className="csr-presets" aria-label="Exemplos de volume mensal">
        {presets.map((preset) => (
          <button key={preset.count} type="button" className={invoices === preset.count ? 'is-active' : ''}
            aria-pressed={invoices === preset.count} onClick={() => onInvoicesChange(preset.count)}>
            <b>{preset.title}</b><span>{preset.count} notas</span>
          </button>
        ))}
      </div>
      <div className="csr-ticket-row">
        <label htmlFor="csr-ticket">Valor médio por venda</label>
        <div className="csr-money-input"><span>R$</span><input id="csr-ticket" type="number" inputMode="decimal" min="1" max="99999" step="0.01"
          value={ticket} onChange={(event) => {
            const value = Number(event.target.value);
            setTicket(Number.isFinite(value) ? Math.max(1, Math.min(99999, value)) : 1);
          }} /></div>
      </div>
      <div className="csr-result" aria-live="polite" aria-atomic="true">
        <div className="csr-result-main"><span>Seu custo estimado neste mês</span><strong>{brl(total)}</strong></div>
        <div className="csr-result-meta"><span>{monthlyFee === 0 ? 'Sem mensalidade' : `${brl(monthlyFee)} de mensalidade`}</span><b>{brl(price)} <small>/ nota</small></b></div>
        <div className="csr-meter" aria-hidden="true"><span style={{ width: `${Math.max(2, Math.min(share * 5, 100))}%` }} /></div>
        <p>Isso representa <strong>{share.toFixed(2).replace('.', ',')}%</strong> do faturamento estimado de {brl(revenue)}.</p>
      </div>
      <button className="csr-disclosure" type="button" onClick={() => setDetailsOpen((open) => !open)} aria-expanded={detailsOpen} aria-controls="csr-calculation-details">
        <span>{detailsOpen ? 'Fechar detalhes do cálculo' : 'Como calculamos seu custo'}</span><b aria-hidden="true">{detailsOpen ? '−' : '+'}</b>
      </button>
      {detailsOpen && <div id="csr-calculation-details" className="csr-explanation">
        <p>{invoices} notas × {brl(price)} por emissão concluída{monthlyFee > 0 ? ` + ${brl(monthlyFee)} de mensalidade` : ''}. Notas rejeitadas pela prefeitura não são cobradas. Sem adesão{monthlyFee === 0 ? ' e sem mensalidade' : ''}.</p>
        <button className="csr-text-link" type="button" onClick={onCompare}>Comparar planos e fontes ↗</button>
      </div>}
    </section>
  );
}
