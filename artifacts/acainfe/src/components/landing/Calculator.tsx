import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { brl, monthlyCost, plans, SOURCES } from '@/config/pricing';

export function Calculator({ price, initialNotes = 30 }: { price: number; initialNotes?: number }) {
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
        <span className="ac-eyebrow">a conta é sua</span>
        <h2 className="ac-h2">Quanto você pagaria por mês?</h2>
        <p className="ac-lead">Coloque quantas notas você emite por mês e compare com os planos de entrada dos concorrentes.</p>
      </header>
      <div className="ac-calc__layout">
        <section className="ac-calc__controls" aria-label="Volume de notas">
          <label className="ac-calc__label" htmlFor="invoice-count">Quantas notas por mês?</label>
          <div className="ac-calc__input-wrap">
            <input id="invoice-count" className="ac-calc__number" type="number" inputMode="numeric" min="0" max="500" step="1" value={notes}
              aria-label="Quantas notas você emite por mês?" onChange={(event) => setCount(Number(event.target.value))} />
            <span>notas</span>
          </div>
          <input className="ac-calc__range" type="range" min="0" max="500" step="1" value={notes}
            aria-label="Ajuste a quantidade de notas por mês" aria-valuetext={`${notes} notas por mês`}
            onChange={(event) => setCount(Number(event.target.value))} />
          <div className="ac-calc__range-labels" aria-hidden="true"><span>0</span><span>500</span></div>
          <div className="ac-calc__presets" aria-label="Atalhos de quantidade">
            {[10, 50, 100, 200].map((value) => <button type="button" key={value} aria-pressed={notes === value} onClick={() => setCount(value)}>{value}</button>)}
          </div>
          <p className="ac-calc__hint">Sem mensalidade. Com zero notas, a conta é zero.</p>
        </section>

        <section className="ac-calc__results" aria-label="Comparação de custos">
          <div className="ac-calc__period" role="group" aria-label="Período dos valores">
            <button type="button" aria-pressed={period === 'month'} onClick={() => setPeriod('month')}>Por mês</button>
            <button type="button" aria-pressed={period === 'year'} onClick={() => setPeriod('year')}>Por ano</button>
          </div>
          <div className="ac-calc__hero-result" aria-live="polite" aria-atomic="true">
            <span>açaínfe</span>
            <strong>{brl(periodValue(acaiMonthly))}<small>/{period === 'year' ? 'ano' : 'mês'}</small></strong>
            <p>{period === 'month' ? `${brl(periodValue(acaiMonthly * 12))} por ano` : `equivale a ${brl(acaiMonthly)} por mês`}</p>
          </div>
          <div className="ac-calc__rank-heading"><span>Planos de entrada</span><span>{period === 'year' ? 'por ano' : 'por mês'}</span></div>
          <ol className="ac-rank-list" aria-label="Planos concorrentes ordenados do menor para o maior custo">
            {rows.map(({ plan, cost }, index) => {
              const unavailable = cost === null;
              const value = unavailable ? null : periodValue(cost);
              const diff = unavailable ? null : cost - acaiMonthly;
              const width = unavailable ? 0 : Math.max(0, (cost / maxCost) * 100);
              return (
                <li className={`ac-rank-row ${unavailable ? 'is-unknown' : ''}`} key={plan.name} data-plan={plan.name} data-rank={index + 1}>
                  <div className="ac-rank-row__meta"><strong>{plan.name}</strong><strong className="ac-rank-row__cost">{unavailable ? 'Acima do plano — consulte' : brl(value!)}</strong></div>
                  <div className="ac-rank-track" aria-hidden="true"><span style={{ width: `${width}%` }} /></div>
                  <p className="ac-rank-row__difference">
                    {unavailable ? 'Preço da nota extra não divulgado' : diff! > 0 ? `+${brl(periodValue(diff!))} ${period === 'year' ? '/ ano' : '/mês'}` : diff! < 0 ? `${brl(periodValue(Math.abs(diff!)))} mais barato` : 'Mesmo custo'}
                  </p>
                </li>
              );
            })}
          </ol>
          <div className={`ac-calc__truth ${winnerIsAcai ? 'is-acai' : 'is-competitor'}`} aria-live="polite">
            <span className="ac-calc__truth-mark" aria-hidden="true">{winnerIsAcai ? '✓' : '↗'}</span>
            <p>{winnerIsAcai
              ? `Com ${notes} notas por mês, a açaínfe é a opção mais barata desta comparação.${highestDifference.plan ? ` Você economiza até ${brl(savings)} por ano frente ao ${highestDifference.plan}.` : ''}`
              : `Com ${notes} notas por mês, o ${least?.plan.name} sai mais barato que a açaínfe. Dizemos isso porque a conta é sua.${highestDifference.amount > 0 ? ` O ${highestDifference.plan} custa ${brl(highestDifference.amount)} a mais por mês (${brl(highestDifference.amount * 12)} por ano).` : ''}`}</p>
          </div>
        </section>
      </div>
      <details className="ac-calc__details">
        <summary><span>Ver tabela completa e fontes</span><ChevronDown size={18} aria-hidden="true" /></summary>
        <div className="ac-tablewrap" role="region" aria-label="Tabela detalhada de preços" tabIndex={0}>
          <table className="ac-table ac-table--wide">
            <thead><tr><th scope="col">Plano de entrada</th><th scope="col">Mensalidade</th><th scope="col">Notas incluídas</th><th scope="col">Nota extra</th></tr></thead>
            <tbody>
              <tr className="me"><th scope="row">açaínfe</th><td>Sem mensalidade</td><td>—</td><td>{brl(price)} por nota emitida com sucesso</td></tr>
              {plans.map((plan) => <tr key={plan.name}><th scope="row">{plan.name}</th><td>{brl(plan.monthly)}</td><td>{plan.included}</td><td>{plan.extra === null ? 'Não divulgado' : brl(plan.extra)}</td></tr>)}
            </tbody>
          </table>
        </div>
        {setupPlan && <p className="ac-fine">{setupPlan.name}: taxa de adesão anunciada de {brl(setupPlan.setup!)}. Não entra no custo mensal nem na economia calculada.</p>}
        <p className="ac-fine">{SOURCES}</p>
        <p className="ac-fine">Os planos e recursos não são iguais; a comparação considera apenas os preços e limites publicados.</p>
      </details>
    </div>
  );
}
