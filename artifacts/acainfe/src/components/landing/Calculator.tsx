import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { annualCost, brl, plans, profiles, SOURCES } from '@/config/pricing';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const CUSTOM = 'Personalizado';
const W = 640, H = 300, PL = 46, PR = 66, PT = 30, PB = 30;

export function Calculator({ price, fee }: { price: number; fee: number }) {
  const presetNames = Object.keys(profiles);
  const [mode, setMode] = useState(presetNames[0]);
  const [custom, setCustom] = useState<number[]>([...profiles[presetNames[0]]]);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const isCustom = mode === CUSTOM;
  const months = isCustom ? custom : profiles[mode];

  const calc = useMemo(() => {
    const total = months.reduce((a, b) => a + b, 0);
    const acai = total * price + fee * 12;
    const rows = plans.map((p) => ({ p, cost: annualCost(p, months) }));
    const valid = rows.filter((r): r is { p: typeof r.p; cost: number } => r.cost !== null).sort((a, b) => a.cost - b.cost);
    const unavailable = rows.filter((r) => r.cost === null).map((r) => r.p.name);
    return { total, acai, cheapest: valid[0] ?? null, unavailable };
  }, [months, price, fee]);

  const line = calc.cheapest ? calc.cheapest.p.monthly : 0;
  const unit = Math.max(price, 1);
  const maxNotes = Math.max(...months, 10);
  const maxCents = Math.max(maxNotes * unit, line, unit * 10) * 1.12;
  const iw = W - PL - PR, ih = H - PT - PB;
  const yOf = (cents: number) => PT + ih - (cents / maxCents) * ih;
  const slot = iw / 12;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  const setMonth = (i: number, v: number) => setCustom((c) => c.map((x, k) => (k === i ? Math.max(0, Math.min(9999, Math.round(v))) : x)));
  const fromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current; if (!svg) return;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    const i = Math.floor((x - PL) / slot);
    if (i < 0 || i > 11) return;
    const cents = ((PT + ih - y) / ih) * maxCents;
    setMonth(i, cents / unit);
  };
  const pickMode = (m: string) => { if (m === CUSTOM) setCustom([...months]); setMode(m); };

  const better = calc.cheapest && calc.acai < calc.cheapest.cost;
  const diff = calc.cheapest ? calc.cheapest.cost - calc.acai : 0;

  return (
    <div className="ac-calc" id="calculadora">
      <span className="ac-eyebrow" style={{ color: 'var(--manga)' }}>faça a conta do seu jeito</span>
      <h3>Quanto você pagaria em 12 meses?</h3>
      <div className="ac-tabs" role="tablist" aria-label="Perfil de vendas">
        {[...presetNames, CUSTOM].map((n) => (
          <button key={n} role="tab" aria-selected={mode === n} className="ac-tab" onClick={() => pickMode(n)}>{n}</button>
        ))}
      </div>
      <div className="ac-calc__grid">
        <div>
          <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className={`ac-chart ${isCustom ? 'is-custom' : ''}`} role="img"
            aria-label={`Notas por mês: ${months.join(', ')}. Linha tracejada: mensalidade de ${brl(line)}.`}
            onPointerDown={(e) => { if (!isCustom) return; dragging.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); fromPointer(e); }}
            onPointerMove={(e) => dragging.current && fromPointer(e)}
            onPointerUp={() => { dragging.current = false; }}>
            {ticks.map((t) => {
              const c = t * maxCents;
              return (
                <g key={t}>
                  <line x1={PL} x2={W - PR} y1={yOf(c)} y2={yOf(c)} stroke="#FFF8EE" strokeOpacity={t === 0 ? 0.5 : 0.1} />
                  <text x={PL - 8} y={yOf(c) + 4} textAnchor="end" fontSize="11" fill="#E9B8DF">{Math.round(c / unit)}</text>
                  <text x={W - PR + 8} y={yOf(c) + 4} fontSize="11" fill="#FFC56B">{brl(c).replace(',00', '')}</text>
                </g>
              );
            })}
            <text x={PL - 8} y={14} textAnchor="end" fontSize="11" fontWeight="700" fill="#E9B8DF">notas</text>
            <text x={W - PR + 8} y={14} fontSize="11" fontWeight="700" fill="#FFC56B">R$ / mês</text>
            {months.map((n, i) => {
              const x = PL + i * slot + slot * 0.16, w = slot * 0.68, y = yOf(n * unit);
              return (
                <g key={i}>
                  <rect className="bar" x={x} width={w} rx="6" style={{ y: `${y}px`, height: `${Math.max(PT + ih - y, n > 0 ? 2 : 0)}px` }} fill={isCustom ? '#D274C0' : '#B957A6'} />
                  <text x={x + w / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="#FFF8EE">{n}</text>
                  <text x={x + w / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="#FFF8EE" fillOpacity=".7">{MONTHS[i]}</text>
                </g>
              );
            })}
            {calc.cheapest && (
              <g>
                <line x1={PL} x2={W - PR} y1={yOf(line)} y2={yOf(line)} stroke="#FF9F1C" strokeWidth="3" strokeDasharray="9 7" strokeLinecap="round" />
                <text x={W - PR - 4} y={yOf(line) - 7} textAnchor="end" fontSize="11" fontWeight="700" fill="#FF9F1C">mensalidade {brl(line)}</text>
              </g>
            )}
          </svg>
          <div className="ac-legend">
            <span><i /> Barras: notas emitidas no mês (eixo esquerdo). A altura equivale ao que você paga no açaínfe, na escala {brl(price)} por nota (eixo direito).</span>
            <span><i className="dash" /> Tracejado: mensalidade do plano de entrada mais barato{calc.cheapest ? ` (${calc.cheapest.p.name})` : ''}, em R$, igual em todo mês.</span>
          </div>
          {isCustom && (
            <>
              <p className="ac-legend" style={{ marginTop: 10 }}>Arraste nas barras ou digite as notas de cada mês:</p>
              <div className="ac-custom">
                {MONTHS.map((m, i) => (
                  <label key={m}>{m}
                    <input type="number" inputMode="numeric" min={0} max={9999} value={custom[i]} aria-label={`Notas em ${m}`}
                      onChange={(e) => setMonth(i, Number(e.target.value) || 0)} />
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="ac-result" aria-live="polite">
          <p>No ano, você pagaria</p>
          <strong className="big">{brl(calc.acai)}</strong>
          <p>no açaínfe ({calc.total} notas).</p>
          {calc.cheapest ? (
            <>
              <p style={{ marginTop: 14 }}>No plano de entrada mais barato com mensalidade ({calc.cheapest.p.name}):</p>
              <strong className="big" style={{ fontSize: '2rem' }}>{brl(calc.cheapest.cost)}</strong>
              {better ? (
                <div className="diff">Diferença<strong>{brl(diff)} no seu bolso</strong></div>
              ) : (
                <div className="diff warn">Com esse volume constante, um plano com mensalidade pode sair mais barato. Fale com a gente: temos condições para volume.</div>
              )}
            </>
          ) : (
            <p style={{ marginTop: 14 }}>Todos os planos de entrada pesquisados exigem plano maior para esse volume.</p>
          )}
          {calc.unavailable.length > 0 && (
            <ul className="ac-plain-list">
              {calc.unavailable.map((n) => <li key={n}>{n}: requer plano maior</li>)}
            </ul>
          )}
        </div>
      </div>
      <p className="ac-calc__foot">{SOURCES}</p>
    </div>
  );
}
