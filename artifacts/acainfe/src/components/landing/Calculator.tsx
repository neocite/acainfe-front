import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { monthlyCost, plans, SOURCES } from '@/config/pricing';
import { landingLanguage, type LandingLocale } from '@/lib/landing-language';

export function Calculator({ price, initialNotes = 30, locale = 'pt' }: { price: number; initialNotes?: number; locale?: LandingLocale }) {
  const { t, money: brl } = landingLanguage(locale);
  const [notes, setNotes] = useState(initialNotes);
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const acaiMonthly = notes * price;
  const rows = useMemo(() => plans
    .map((plan) => ({ plan, cost: monthlyCost(plan, notes) }))
    .sort((a, b) => {
      if (a.cost === null) return b.cost === null ? 0 : 1;
      if (b.cost === null) return -1;
      return a.cost - b.cost;
    }), [notes]);
  const valid = rows.filter((row): row is { plan: (typeof plans)[number]; cost: number } => row.cost !== null);
  const least = valid[0];
  const winnerIsAcai = !least || acaiMonthly <= least.cost;
  const maxCost = Math.max(acaiMonthly, ...valid.map(({ cost }) => cost), 1);
  const highestDifference = valid.reduce((best, row) => row.cost - acaiMonthly > best.amount
    ? { amount: row.cost - acaiMonthly, plan: row.plan.name }
    : best, { amount: 0, plan: '' });
  const periodValue = (cents: number) => cents * (period === 'year' ? 12 : 1);
  const setCount = (value: number) => setNotes(Math.max(0, Math.min(500, Math.round(Number.isFinite(value) ? value : 0))));
  const savings = highestDifference.amount * 12;
  const setupPlan = plans.find((plan) => plan.setup);

  return (
    <div className="ac-calc">
      <header className="ac-calc__intro">
        <span className="ac-eyebrow">{t('a conta é sua', 'the choice is yours')}</span>
        <h2 className="ac-h2">{t('Quanto você pagaria por mês?', 'How much would you pay per month?')}</h2>
        <p className="ac-lead">{t('Coloque quantas notas você emite por mês e compare com os planos de entrada dos concorrentes.', 'Enter your monthly invoice volume and compare competitors’ entry-level plans.')}</p>
      </header>
      <div className="ac-calc__layout">
        <section className="ac-calc__controls" aria-label={t('Volume de notas', 'Invoice volume')}>
          <label className="ac-calc__label" htmlFor="invoice-count">{t('Quantas notas por mês?', 'How many invoices per month?')}</label>
          <div className="ac-calc__input-wrap">
            <input id="invoice-count" className="ac-calc__number" type="number" inputMode="numeric" min="0" max="500" step="1" value={notes}
              aria-label={t('Quantas notas você emite por mês?', 'How many invoices do you issue per month?')} onChange={(event) => setCount(Number(event.target.value))} />
            <span>{t('notas', 'invoices')}</span>
          </div>
          <input className="ac-calc__range" type="range" min="0" max="500" step="1" value={notes}
            aria-label={t('Ajuste a quantidade de notas por mês', 'Adjust monthly invoice volume')} aria-valuetext={t(`${notes} notas por mês`, `${notes} invoices per month`)}
            onChange={(event) => setCount(Number(event.target.value))} />
          <div className="ac-calc__range-labels" aria-hidden="true"><span>0</span><span>500</span></div>
          <div className="ac-calc__presets" aria-label={t('Atalhos de quantidade', 'Volume presets')}>
            {[10, 50, 100, 200].map((value) => <button type="button" key={value} aria-pressed={notes === value} onClick={() => setCount(value)}>{value}</button>)}
          </div>
          <p className="ac-calc__hint">{t('Sem mensalidade. Com zero notas, a conta é zero.', 'No monthly fee. Zero invoices means zero cost.')}</p>
        </section>

        <section className="ac-calc__results" aria-label={t('Comparação de custos', 'Cost comparison')}>
          <div className="ac-calc__period" role="group" aria-label={t('Período dos valores', 'Billing period')}>
            <button type="button" aria-pressed={period === 'month'} onClick={() => setPeriod('month')}>{t('Por mês', 'Per month')}</button>
            <button type="button" aria-pressed={period === 'year'} onClick={() => setPeriod('year')}>{t('Por ano', 'Per year')}</button>
          </div>
          <div className="ac-calc__hero-result" aria-live="polite" aria-atomic="true">
            <span>açaínfe</span>
            <strong>{brl(periodValue(acaiMonthly))}<small>/{period === 'year' ? t('ano', 'year') : t('mês', 'month')}</small></strong>
            <p>{period === 'month' ? t(`${brl(periodValue(acaiMonthly * 12))} por ano`, `${brl(periodValue(acaiMonthly * 12))} per year`) : t(`equivale a ${brl(acaiMonthly)} por mês`, `equivalent to ${brl(acaiMonthly)} per month`)}</p>
          </div>
          <div className="ac-calc__rank-heading"><span>{t('Planos de entrada', 'Entry-level plans')}</span><span>{period === 'year' ? t('por ano', 'per year') : t('por mês', 'per month')}</span></div>
          <ol className="ac-rank-list" aria-label={t('Planos concorrentes ordenados do menor para o maior custo', 'Competitor plans ordered from lowest to highest cost')}>
            {rows.map(({ plan, cost }, index) => {
              const unavailable = cost === null;
              const value = unavailable ? null : periodValue(cost);
              const diff = unavailable ? null : cost - acaiMonthly;
              const width = unavailable ? 0 : Math.max(0, (cost / maxCost) * 100);
              return (
                <li className={`ac-rank-row ${unavailable ? 'is-unknown' : ''}`} key={plan.name} data-plan={plan.name} data-rank={index + 1}>
                  <div className="ac-rank-row__meta"><strong>{plan.name}</strong><strong className="ac-rank-row__cost">{unavailable ? t('Acima do plano — consulte', 'Over plan limit — contact provider') : brl(value!)}</strong></div>
                  <div className="ac-rank-track" aria-hidden="true"><span style={{ width: `${width}%` }} /></div>
                  <p className="ac-rank-row__difference">
                    {unavailable ? t('Preço da nota extra não divulgado', 'Extra invoice price not disclosed') : diff! > 0 ? `+${brl(periodValue(diff!))} ${period === 'year' ? t('/ ano', '/ year') : t('/mês', '/month')}` : diff! < 0 ? t(`${brl(periodValue(Math.abs(diff!)))} mais barato`, `${brl(periodValue(Math.abs(diff!)))} cheaper`) : t('Mesmo custo', 'Same cost')}
                  </p>
                </li>
              );
            })}
          </ol>
          <div className={`ac-calc__truth ${winnerIsAcai ? 'is-acai' : 'is-competitor'}`} aria-live="polite">
            <span className="ac-calc__truth-mark" aria-hidden="true">{winnerIsAcai ? '✓' : '↗'}</span>
            <p>{locale === 'en' ? (winnerIsAcai
              ? `At ${notes} invoices per month, açaínfe is the cheapest option in this comparison.${highestDifference.plan ? ` Save up to ${brl(savings)} per year compared with ${highestDifference.plan}.` : ''}`
              : `At ${notes} invoices per month, ${least?.plan.name} is cheaper than açaínfe. We tell you because the choice is yours.${highestDifference.amount > 0 ? ` ${highestDifference.plan} costs ${brl(highestDifference.amount)} more per month (${brl(highestDifference.amount * 12)} per year).` : ''}`)
              : winnerIsAcai
              ? `Com ${notes} notas por mês, a açaínfe é a opção mais barata desta comparação.${highestDifference.plan ? ` Você economiza até ${brl(savings)} por ano frente ao ${highestDifference.plan}.` : ''}`
              : `Com ${notes} notas por mês, o ${least?.plan.name} sai mais barato que a açaínfe. Dizemos isso porque a conta é sua.${highestDifference.amount > 0 ? ` O ${highestDifference.plan} custa ${brl(highestDifference.amount)} a mais por mês (${brl(highestDifference.amount * 12)} por ano).` : ''}`}</p>
          </div>
        </section>
      </div>
      <details className="ac-calc__details">
        <summary><span>{t('Ver tabela completa e fontes', 'See full pricing table and sources')}</span><ChevronDown size={18} aria-hidden="true" /></summary>
        <div className="ac-tablewrap" role="region" aria-label={t('Tabela detalhada de preços', 'Detailed pricing table')} tabIndex={0}>
          <table className="ac-table ac-table--wide">
            <thead><tr><th scope="col">{t('Plano de entrada', 'Entry-level plan')}</th><th scope="col">{t('Mensalidade', 'Monthly fee')}</th><th scope="col">{t('Notas incluídas', 'Included invoices')}</th><th scope="col">{t('Nota extra', 'Extra invoice')}</th></tr></thead>
            <tbody>
              <tr className="me"><th scope="row">açaínfe</th><td>{t('Sem mensalidade', 'No monthly fee')}</td><td>—</td><td>{brl(price)} {t('por nota emitida com sucesso', 'per successfully issued invoice')}</td></tr>
              {plans.map((plan) => <tr key={plan.name}><th scope="row">{plan.name}</th><td>{brl(plan.monthly)}</td><td>{plan.included}</td><td>{plan.extra === null ? t('Não divulgado', 'Not disclosed') : brl(plan.extra)}</td></tr>)}
            </tbody>
          </table>
        </div>
        {setupPlan && <p className="ac-fine">{setupPlan.name}: {t(`taxa de adesão anunciada de ${brl(setupPlan.setup!)}. Não entra no custo mensal nem na economia calculada.`, `advertised setup fee of ${brl(setupPlan.setup!)}. Not included in monthly costs or calculated savings.`)}</p>}
        <p className="ac-fine">{t(SOURCES, 'Entry-level prices published on official websites, checked on October 19, 2026: focusnfe.com.br, notazz.com, enotas.com.br/precos and nfe.io/precos. Monthly prices; the Notazz Bronze setup fee is not included. Plans and features differ. Prices may change; confirm with each provider.')}</p>
        <p className="ac-fine">{t('Os planos e recursos não são iguais; a comparação considera apenas os preços e limites publicados.', 'Plans and features differ; this comparison considers only published prices and limits.')}</p>
      </details>
    </div>
  );
}
