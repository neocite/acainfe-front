import { useState } from 'react';
import { Link } from 'wouter';
import { annualCost, brl, monthlyCost, plans, profiles, SOURCES, type Plan } from '@/config/pricing';

const label = (p: Plan) => (p.name.startsWith('Spedy') ? 'Spedy Essencial (anual, pago adiantado)' : p.name);
const labelShort = (p: Plan) => (p.name.startsWith('Spedy') ? 'Spedy Essencial (plano anual)' : p.name);
const fee = (p: Plan) =>
  p.annual ? <>{brl(p.monthly)}/mês<small>({brl(p.annual)} cobrados no ano)</small></> :
  p.setup ? <>{brl(p.monthly)}<small>(+ adesão anunciada de {brl(p.setup)})</small></> : brl(p.monthly);
const COLS = [10, 50, 100];

export function Comparison({ price, monthlyFee }: { price: number; monthlyFee: number }) {
  const [tab, setTab] = useState<'ano' | 'mes'>('ano');
  const launch = profiles['Faço lançamentos'];
  const total = launch.reduce((a, b) => a + b, 0);
  const acaiYear = total * price + monthlyFee * 12;
  const rows = plans.map((p) => ({ p, cost: annualCost(p, launch) })).filter((r): r is { p: Plan; cost: number } => r.cost !== null);
  const excluded = plans.filter((p) => annualCost(p, launch) === null).map((p) => p.name);

  const acaiMonth = (n: number) => n * price + monthlyFee;
  const colMin = COLS.map((n) => Math.min(acaiMonth(n), ...plans.map((p) => monthlyCost(p, n)).filter((v): v is number => v !== null)));
  const losing = COLS.map((n, i) => ({ n, who: plans.filter((p) => monthlyCost(p, n) === colMin[i] && acaiMonth(n) > colMin[i]) })).filter((x) => x.who.length);

  return (
    <div>
      <div className="ac-cmp-tabs" role="tablist" aria-label="Tipo de comparativo">
        <button role="tab" aria-selected={tab === 'ano'} onClick={() => setTab('ano')}>No ano</button>
        <button role="tab" aria-selected={tab === 'mes'} onClick={() => setTab('mes')}>Por mês</button>
      </div>

      {tab === 'ano' ? (
        <div role="tabpanel">
          <p className="ac-lead" style={{ marginBottom: 18 }}>Um ano típico de quem faz lançamentos (2 meses com 150 vendas e 10 meses com 5 vendas, {total} notas no total):</p>
          <div className="ac-tablewrap">
            <table className="ac-table">
              <thead><tr><th>Plataforma (plano de entrada)</th><th>Custo no ano</th><th>Diferença para o açaínfe</th></tr></thead>
              <tbody>
                <tr className="me"><th scope="row">açaínfe</th><td className="num">{brl(acaiYear)}</td><td>—</td></tr>
                {rows.map(({ p, cost }) => (
                  <tr key={p.name}><th scope="row">{label(p)}</th><td className="num">{brl(cost)}</td><td className="num">{cost - acaiYear >= 0 ? '+' : '-'}{brl(Math.abs(cost - acaiYear))}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {excluded.length > 0 && <p className="ac-fine">{excluded.join(', ')} fica fora desta aba: não publica preço de nota extra acima do pacote incluído.</p>}
        </div>
      ) : (
        <div role="tabpanel">
          <p className="ac-lead" style={{ marginBottom: 18 }}>Quanto você pagaria em um mês em cada plano de entrada:</p>
          <div className="ac-tablewrap">
            <table className="ac-table ac-table--wide">
              <thead><tr><th>Plataforma (plano de entrada)</th><th>Mensalidade</th><th>Notas incluídas</th><th>Nota extra</th>{COLS.map((n) => <th key={n}>{n} notas/mês</th>)}</tr></thead>
              <tbody>
                <tr className="me">
                  <th scope="row">açaínfe</th><td>{brl(monthlyFee)}</td><td>—</td><td className="num">{brl(price)}</td>
                  {COLS.map((n, i) => <td key={n} className={`num ${acaiMonth(n) === colMin[i] ? 'min' : ''}`}>{brl(acaiMonth(n))}</td>)}
                </tr>
                {plans.map((p) => (
                  <tr key={p.name}>
                    <th scope="row">{labelShort(p)}</th><td>{fee(p)}</td>
                    <td className="num">{p.annual ? `${(p.annualIncluded ?? 0).toLocaleString('pt-BR')}/ano` : p.included.toLocaleString('pt-BR')}</td>
                    <td className="num">{p.extra === null ? '—' : brl(p.extra)}</td>
                    {COLS.map((n, i) => {
                      const v = monthlyCost(p, n);
                      return <td key={n} className={`num ${v !== null && v === colMin[i] ? 'min' : ''}`}>{v === null ? 'requer plano maior' : brl(v)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {losing.map((l) => (
            <p key={l.n} className="ac-callout">Na coluna de {l.n} notas, {l.who.map(labelShort).join(' e ')} ({brl(colMin[COLS.indexOf(l.n)])}) é a opção mais barata da tabela. Dizemos isso porque a conta é sua.</p>
          ))}
        </div>
      )}
      <p className="ac-fine">{SOURCES}</p>
      <div style={{ marginTop: 24 }}>
        <Link href="/app" className="ac-btn ac-btn--manga ac-btn--lg">Quero parar de pagar mensalidade</Link>
        <p className="ac-micro">Sem mensalidade. Não vendeu, não pagou.</p>
      </div>
    </div>
  );
}
