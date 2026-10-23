import { useState } from 'react';
import { landingLanguage, type LandingLocale } from '@/lib/landing-language';

const presets = [
  { count: 12, title: 'Mês tranquilo' },
  { count: 48, title: 'Ritmo constante' },
  { count: 126, title: 'Mês de lançamento' },
];

export function StudioCalculator({ price, monthlyFee, invoices, onInvoicesChange, onCompare, locale = 'pt' }: {
  price: number;
  monthlyFee: number;
  invoices: number;
  onInvoicesChange: (count: number) => void;
  onCompare: () => void;
  locale?: LandingLocale;
}) {
  const { t, money: brl } = landingLanguage(locale);
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
        <div><span className="csr-label">{t('SIMULADOR DE CUSTO', 'COST CALCULATOR')}</span><h2 id="csr-calc-title">{t('Um mês na sua operação', 'A month in your business')}</h2></div>
        <span className="csr-calc-index">01 <i>—</i> 03</span>
      </div>
      <label className="csr-range-title" htmlFor="csr-invoices"><span>{t('Notas emitidas', 'Invoices issued')}</span><strong>{invoices}<small>{t(' / mês', ' / month')}</small></strong></label>
      <input id="csr-invoices" className="csr-range" type="range" min="0" max="200" step="1"
        value={invoices} onChange={(event) => onInvoicesChange(Number(event.target.value))}
        style={{ backgroundImage: `linear-gradient(90deg, #8c4b79 ${progress}%, #e7dcd7 ${progress}%)` }}
        aria-label={t('Quantidade de notas emitidas por mês', 'Number of invoices issued per month')} />
      <div className="csr-range-ends"><span>{t('0 notas', '0 invoices')}</span><span>{t('200 notas', '200 invoices')}</span></div>
      <div className="csr-presets" aria-label={t('Exemplos de volume mensal', 'Monthly volume presets')}>
        {presets.map((preset) => (
          <button key={preset.count} type="button" className={invoices === preset.count ? 'is-active' : ''}
            aria-pressed={invoices === preset.count} onClick={() => onInvoicesChange(preset.count)}>
            <b>{locale === 'en' ? ({12: 'Quiet month', 48: 'Steady pace', 126: 'Launch month'}[preset.count]) : preset.title}</b><span>{preset.count} {t('notas', 'invoices')}</span>
          </button>
        ))}
      </div>
      <div className="csr-ticket-row">
        <label htmlFor="csr-ticket">{t('Valor médio por venda', 'Average sale value')}</label>
        <div className="csr-money-input"><span>R$</span><input id="csr-ticket" type="number" inputMode="decimal" min="1" max="99999" step="0.01"
          value={ticket} onChange={(event) => {
            const value = Number(event.target.value);
            setTicket(Number.isFinite(value) ? Math.max(1, Math.min(99999, value)) : 1);
          }} /></div>
      </div>
      <div className="csr-result" aria-live="polite" aria-atomic="true">
        <div className="csr-result-main"><span>{t('Seu custo estimado neste mês', 'Your estimated cost this month')}</span><strong>{brl(total)}</strong></div>
        <div className="csr-result-meta"><span>{monthlyFee === 0 ? t('Sem mensalidade', 'No monthly fee') : t(`${brl(monthlyFee)} de mensalidade`, `${brl(monthlyFee)} monthly fee`)}</span><b>{brl(price)} <small>{t('/ nota', '/ invoice')}</small></b></div>
        <div className="csr-meter" aria-hidden="true"><span style={{ width: `${Math.max(2, Math.min(share * 5, 100))}%` }} /></div>
        <p>{t('Isso representa', 'That is')} <strong>{locale === 'en' ? share.toFixed(2) : share.toFixed(2).replace('.', ',')}%</strong> {t('do faturamento estimado de', 'of estimated revenue of')} {brl(revenue)}.</p>
      </div>
      <button className="csr-disclosure" type="button" onClick={() => setDetailsOpen((open) => !open)} aria-expanded={detailsOpen} aria-controls="csr-calculation-details">
        <span>{detailsOpen ? t('Fechar detalhes do cálculo', 'Hide calculation details') : t('Como calculamos seu custo', 'How we calculate your cost')}</span><b aria-hidden="true">{detailsOpen ? '−' : '+'}</b>
      </button>
      {detailsOpen && <div id="csr-calculation-details" className="csr-explanation">
        <p>{invoices} {t('notas', 'invoices')} × {brl(price)} {t('por emissão concluída', 'per successfully issued invoice')}{monthlyFee > 0 ? t(` + ${brl(monthlyFee)} de mensalidade`, ` + ${brl(monthlyFee)} monthly fee`) : ''}. {t('Notas rejeitadas pela prefeitura não são cobradas. Sem adesão', 'Invoices rejected by the municipality are not charged. No setup fee')}{monthlyFee === 0 ? t(' e sem mensalidade', ' or monthly fee') : ''}.</p>
        <button className="csr-text-link" type="button" onClick={onCompare}>{t('Comparar planos e fontes ↗', 'Compare plans and sources ↗')}</button>
      </div>}
    </section>
  );
}
