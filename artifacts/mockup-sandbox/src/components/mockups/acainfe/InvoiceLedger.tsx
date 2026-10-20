import { useState } from "react";
import "./invoice-ledger.css";

const fmt = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const plans = [
  { name: "Focus NFe Solo", monthly: 94.9, included: 100, extra: 0.11 },
  { name: "Notazz Bronze", monthly: 133.9, included: 100, extra: null },
  { name: "eNotas Basic", monthly: 137, included: 60, extra: 0.77 },
  { name: "NFE.io Base", monthly: 190, included: 250, extra: null },
];

const faqs = [
  ["Preciso de certificado digital?", "Sim. O certificado A1 (.pfx), o mesmo usado no e-CAC, fica criptografado e é usado para assinar suas notas."],
  ["Minha cidade já é atendida?", "Hoje atendemos São Bernardo do Campo (SP), para empresas do Simples Nacional e MEI. Em outras cidades, você pode entrar na lista de espera."],
  ["E se a prefeitura sair do ar?", "A emissão entra em uma fila segura e é retomada automaticamente quando o sistema municipal voltar."],
  ["E se eu não vender nada?", "Você não paga nada. Sem mensalidade, adesão nem plano: a cobrança é apenas por nota emitida com sucesso."],
];

export default function InvoiceLedger() {
  const [volume, setVolume] = useState(48);
  const [menuOpen, setMenuOpen] = useState(false);
  const monthly = volume * 0.8;
  const revenue = volume * 197;
  const rows = plans.map((plan) => ({
    ...plan,
    cost: plan.extra === null && volume > plan.included
      ? null
      : plan.monthly + Math.max(0, volume - plan.included) * (plan.extra ?? 0),
  }));
  const best = rows.reduce<number | null>((lowest, row) =>
    row.cost !== null && (lowest === null || row.cost < lowest) ? row.cost : lowest, null);

  return (
    <div className="il-page" id="top">
      <header className="il-header">
        <a className="il-brand" href="#top" aria-label="açaínfe, início">aça<span>í</span>nfe<i /></a>
        <button className="il-menu" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label="Abrir navegação">
          {menuOpen ? "Fechar −" : "Menu +"}
        </button>
        <nav className={menuOpen ? "il-nav il-nav-open" : "il-nav"} aria-label="Navegação principal">
          <a onClick={() => setMenuOpen(false)} href="#simulador">Simulador</a>
          <a onClick={() => setMenuOpen(false)} href="#como-funciona">Como funciona</a>
          <a onClick={() => setMenuOpen(false)} href="#duvidas">Dúvidas</a>
          <a className="il-nav-cta" href="/app">Começar agora <span>↗</span></a>
        </nav>
      </header>

      <main>
        <section className="il-hero">
          <div className="il-hero-index"><span>NFSE / 01</span><span>Para quem vende online</span></div>
          <div className="il-hero-copy">
            <p className="il-kicker"><b /> ABACATEPAY + HOTMART</p>
            <h1>Vendeu.<br /><em>A nota foi.</em></h1>
            <p className="il-intro">Cada pagamento aprovado vira uma NFS-e enviada ao cliente. Sem planilha no fim do mês, sem mensalidade nos meses quietos.</p>
            <a className="il-text-link" href="#simulador">Faça a conta do seu mês <span>↓</span></a>
          </div>
          <div className="il-hero-art" aria-hidden="true">
            <div className="il-stamp"><span>NOTA</span><b>✓</b><small>EMITIDA</small></div>
            <div className="il-orbit il-orbit-one" />
            <div className="il-orbit il-orbit-two" />
            <div className="il-art-paper">
              <span className="il-paper-mark">a.</span>
              <span className="il-paper-tag">NFS-e · SERVIÇO</span>
              <strong>R$ 197,00</strong>
              <i /><i /><i className="short" />
              <span className="il-paper-foot">CLIENTE · MARINA S.</span>
            </div>
            <div className="il-send-note"><span>→</span> enviada por e-mail<br />e WhatsApp</div>
            <span className="il-art-caption">UM PAGAMENTO.<br />UMA NOTA.</span>
          </div>
          <div className="il-hero-bottom">
            <span>01 — A CONTA É SIMPLES</span>
            <span>R$ 0,80 <small>por nota emitida com sucesso</small></span>
            <a href="#como-funciona">Veja o fluxo <span>↓</span></a>
          </div>
        </section>

        <section className="il-simulator" id="simulador">
          <div className="il-sim-intro">
            <p className="il-kicker">02 / SIMULADOR DE CUSTO</p>
            <h2>Seu mês.<br /><em>Sem chute.</em></h2>
            <p>Veja como o custo acompanha o ritmo das suas vendas.</p>
            <div className="il-sim-count"><strong>{volume}</strong><span>notas<br />no mês</span></div>
            <label className="il-slider-label" htmlFor="il-volume">Ajuste o volume</label>
            <input id="il-volume" type="range" min="0" max="500" value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
            <div className="il-range-labels"><span>0</span><span>500 notas</span></div>
            <div className="il-presets">
              {[12, 48, 126].map((count) => <button key={count} aria-pressed={volume === count} onClick={() => setVolume(count)}>{count} notas</button>)}
            </div>
          </div>
          <div className="il-sim-result">
            <div className="il-result-top"><span>VOCÊ PAGA NESTE MÊS</span><span>SEM MENSALIDADE</span></div>
            <strong className="il-total">{fmt(monthly)}</strong>
            <div className="il-equation"><span>{volume} notas</span><b>×</b><span>R$ 0,80</span><b>=</b><strong>{fmt(monthly)}</strong></div>
            <div className="il-meter"><span style={{ width: `${Math.min(100, revenue ? monthly / revenue * 900 : 0)}%` }} /></div>
            <p>Isso representa <b>{revenue ? ((monthly / revenue) * 100).toFixed(2).replace(".", ",") : "0,00"}%</b> de uma receita estimada de {fmt(revenue)}.</p>
            <div className="il-quiet"><span>Sem venda</span><strong>R$ 0</strong><span>Sem nota, sem cobrança.</span></div>
            <p className="il-fine">Notas rejeitadas pela prefeitura não são cobradas. Sem taxa de adesão.</p>
          </div>
        </section>

        <section className="il-compare" aria-label="Comparação de custos">
          <div className="il-compare-heading">
            <p className="il-kicker">03 / A CONTA É SUA</p>
            <h2>Mensalidade cobra.<br /><em>Mesmo sem vender.</em></h2>
            <p>Planos de entrada para {volume} notas por mês. Os planos e recursos não são iguais; compare apenas preços e limites publicados.</p>
          </div>
          <div className="il-compare-list">
            <div className="il-compare-row il-compare-label"><span>PLANO DE ENTRADA</span><span>CUSTO ESTIMADO</span></div>
            <div className="il-compare-row il-compare-acai"><span><b>açaínfe</b><small>sem mensalidade · R$ 0,80 por emissão</small></span><strong>{fmt(monthly)}<small>/ mês</small></strong></div>
            {rows.map((plan) => (
              <div className="il-compare-row" key={plan.name}>
                <span><b>{plan.name}</b><small>{plan.included} notas incluídas</small></span>
                <strong>{plan.cost === null ? "Consulte" : fmt(plan.cost)}{plan.cost !== null && <small>/ mês</small>}</strong>
              </div>
            ))}
            <p className="il-compare-note">{best !== null && monthly <= best ? `Açaínfe fica ${fmt(best - monthly)} abaixo do plano de entrada mais barato neste volume.` : "Com mensalidade, o custo não pausa quando suas vendas pausam."} Preços publicados em 19/10/2026; confirme com cada fornecedor.</p>
          </div>
        </section>

        <section className="il-process" id="como-funciona">
          <div className="il-process-head"><p className="il-kicker">04 / DO PAGAMENTO À NOTA</p><h2>Configure uma vez.<br /><em>Depois, a venda faz o resto.</em></h2></div>
          <div className="il-steps">
            <article><span>01</span><div><small>CONECTE</small><h3>Envie o certificado A1</h3><p>Entre e envie seu certificado. Encontramos seus dados fiscais.</p></div><b>↗</b></article>
            <article><span>02</span><div><small>CONFIGURE</small><h3>Conecte sua plataforma</h3><p>AbacatePay ou Hotmart: conecte de onde vêm suas vendas.</p></div><b>⌘</b></article>
            <article><span>03</span><div><small>AUTOMATIZE</small><h3>Venda. Nota entregue.</h3><p>Configure seus produtos com IA. Cada pagamento aprovado vira nota.</p></div><b>✓</b></article>
          </div>
        </section>

        <section className="il-availability">
          <div><p className="il-kicker">05 / DISPONIBILIDADE</p><h2>Uma cidade de cada vez.<br /><em>Com cuidado em cada nota.</em></h2></div>
          <div className="il-city"><span>◎</span><div><strong>São Bernardo do Campo</strong><small>São Paulo · MEI e Simples Nacional</small></div><b>ATIVO</b></div>
          <p>Estamos ampliando a cobertura. Em outra cidade? Entre na lista de espera e avisamos quando chegarmos até você.</p>
        </section>

        <section className="il-faq" id="duvidas">
          <div><p className="il-kicker">06 / SEM LETRA MIÚDA</p><h2>Respostas<br /><em>diretas.</em></h2></div>
          <div className="il-faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div>
        </section>

        <section className="il-end" id="comece">
          <span className="il-end-index">07 — PRONTO?</span>
          <p>O próximo pagamento</p><h2>já pode virar <em>nota.</em></h2>
          <a href="/app">Começar agora <span>↗</span></a>
          <small>Sem mensalidade. Sem taxa de adesão.</small>
        </section>
      </main>
      <footer className="il-footer"><a className="il-brand" href="#top">aça<span>í</span>nfe<i /></a><span>Emissão de NFS-e que acompanha suas vendas.</span><small>Produto independente. Não afiliado ao AbacatePay nem à Hotmart.</small></footer>
    </div>
  );
}
