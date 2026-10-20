import { useMemo, useState } from "react";
import "./coststudio.css";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const examples = [
  { count: 12, label: "Começando", note: "um mês mais tranquilo" },
  { count: 48, label: "Em ritmo", note: "vendas recorrentes" },
  { count: 126, label: "Lançamento", note: "pico de vendas" },
];

export default function CostStudio() {
  const [invoices, setInvoices] = useState(48);
  const [ticket, setTicket] = useState(197);
  const [showDetails, setShowDetails] = useState(false);
  const monthly = invoices * 0.8;
  const share = useMemo(() => ((monthly / (invoices * ticket)) * 100).toFixed(2).replace(".", ","), [monthly, invoices, ticket]);

  return (
    <div className="cs-page">
      <header className="cs-nav">
        <a href="#inicio" className="cs-wordmark" aria-label="açaínfe, início">
          aça<span>í</span>nfe
          <i aria-hidden="true" />
        </a>
        <nav aria-label="Navegação principal">
          <a href="#simulador">Simule seu mês</a>
          <a href="#funciona">Como funciona</a>
          <a href="#duvidas">Dúvidas</a>
        </nav>
        <a className="cs-nav-cta" href="#comece">Criar conta <span>↗</span></a>
      </header>

      <main id="inicio">
        <section className="cs-hero">
          <div className="cs-kicker"><span className="cs-live-dot" /> NFS-e que acompanha o seu negócio</div>
          <div className="cs-hero-grid">
            <div className="cs-intro">
              <p className="cs-overline">Seu mês, sem taxa fixa.</p>
              <h1>Vendeu.<br /><em>A nota foi.</em></h1>
              <p className="cs-lead">A emissão acontece junto com cada pagamento aprovado no AbacatePay. Sem planilha no fim do mês, sem mensalidade nos meses quietos.</p>
              <a className="cs-primary" href="#simulador">Descubra seu custo real <span>↓</span></a>
              <p className="cs-guarantee"><span>✓</span> Só R$ 0,80 por nota emitida com sucesso</p>
            </div>

            <div className="cs-calculator" id="simulador">
              <div className="cs-calc-head">
                <div>
                  <span className="cs-label">SIMULADOR DE CUSTO</span>
                  <h2>Um mês na sua operação</h2>
                </div>
                <span className="cs-calc-mark">01 <i>—</i> 02</span>
              </div>

              <label className="cs-slider-label" htmlFor="invoice-count">
                <span>Notas emitidas</span><strong>{invoices}<small> / mês</small></strong>
              </label>
              <input id="invoice-count" className="cs-range" style={{ background: `linear-gradient(90deg, #8e4f7c 0%, #8e4f7c ${(invoices / 200) * 100}%, #e9dfd7 ${(invoices / 200) * 100}%, #e9dfd7 100%)` }} type="range" min="1" max="200" value={invoices} onChange={(e) => setInvoices(Number(e.target.value))} />
              <div className="cs-range-ends"><span>1 nota</span><span>200 notas</span></div>

              <div className="cs-presets" aria-label="Escolha um volume de exemplo">
                {examples.map((item) => (
                  <button key={item.label} className={invoices === item.count ? "is-active" : ""} onClick={() => setInvoices(item.count)}>
                    <b>{item.label}</b><span>{item.count} notas</span>
                  </button>
                ))}
              </div>

              <div className="cs-ticket-row">
                <label htmlFor="average-ticket">Valor médio da venda</label>
                <div className="cs-currency-input"><span>R$</span><input id="average-ticket" type="number" min="1" max="99999" value={ticket} onChange={(e) => setTicket(Math.max(1, Number(e.target.value) || 1))} /></div>
              </div>

              <div className="cs-result">
                <div className="cs-result-copy"><span>Você paga neste mês</span><b>{money(monthly)}</b></div>
                <div className="cs-result-unit"><span>por nota</span><strong>R$ 0,80</strong></div>
                <div className="cs-result-rule"><span style={{ width: `${Math.min(Number(share) * 5, 100)}%` }} /></div>
                <p>Isso representa <strong>{share}%</strong> do seu faturamento estimado de {money(invoices * ticket)}.</p>
              </div>
              <button className="cs-details" onClick={() => setShowDetails((open) => !open)} aria-expanded={showDetails}>
                {showDetails ? "Fechar cálculo" : "Como chegamos nesse valor"} <span>{showDetails ? "−" : "+"}</span>
              </button>
              {showDetails && <div className="cs-explain">{invoices} notas × R$ 0,80 por emissão concluída. Notas rejeitadas pela prefeitura não são cobradas. Sem taxa de adesão nem mensalidade.</div>}
            </div>
          </div>
          <div className="cs-hero-foot"><span>01 / A CONTA É SIMPLES</span><span>Arraste o controle e veja acontecer <b>↘</b></span></div>
        </section>

        <section className="cs-proof" aria-label="Princípios do serviço">
          <div><span className="cs-proof-index">A.</span><p>Seu negócio tem meses<br /><strong>de todo tamanho.</strong></p></div>
          <div className="cs-proof-equation">R$ 0 fixos <span>+</span> R$ 0,80 por nota</div>
          <div><span className="cs-proof-index">B.</span><p>A cobrança acompanha<br /><strong>o que você vendeu.</strong></p></div>
        </section>

        <section className="cs-process" id="funciona">
          <div className="cs-section-heading">
            <span className="cs-label">DO PAGAMENTO À NOTA</span>
            <h2>Você cuida da venda.<br /><em>A gente fecha o ciclo.</em></h2>
          </div>
          <div className="cs-flow">
            <div className="cs-flow-track"><span /><span /><span /></div>
            <article><small>01 — CONECTE</small><div className="cs-flow-icon">↗</div><h3>AbacatePay<br />conectado</h3><p>Uma chave de integração. O açaínfe escuta cada pagamento aprovado.</p></article>
            <article><small>02 — CONFIGURE</small><div className="cs-flow-icon">⌘</div><h3>Produto<br />mapeado</h3><p>Configure seus serviços com ajuda do assistente. Código fiscal certo, por produto.</p></article>
            <article><small>03 — AUTOMATIZE</small><div className="cs-flow-icon cs-flow-icon--check">✓</div><h3>Nota<br />entregue</h3><p>A NFS-e é emitida e enviada ao cliente por e-mail e WhatsApp.</p></article>
          </div>
        </section>

        <section className="cs-quiet">
          <div className="cs-quiet-quote">“</div>
          <div>
            <span className="cs-label">E QUANDO NÃO TEM VENDA?</span>
            <h2>O custo também<br />fica em <em>pausa.</em></h2>
          </div>
          <div className="cs-quiet-note"><span className="cs-zero">R$ 0</span><p>Sem venda, sem nota.<br /><strong>Sem nota, sem cobrança.</strong></p><span className="cs-note-line" /></div>
        </section>

        <section className="cs-availability">
          <div><span className="cs-label">DISPONÍVEL HOJE</span><h2>Uma cidade de cada vez.<br /><em>Com cuidado em cada nota.</em></h2></div>
          <div className="cs-city"><span className="cs-pin">◎</span><div><strong>São Bernardo do Campo</strong><span>São Paulo · MEI e Simples Nacional</span></div><span className="cs-city-status">ATIVO</span></div>
          <p>Estamos ampliando a cobertura. Se sua empresa está em outra cidade, entre na lista e avisamos quando chegar até você.</p>
          <a href="#comece" className="cs-waitlist">Ver disponibilidade para minha empresa <span>↗</span></a>
        </section>

        <section className="cs-faq" id="duvidas">
          <div><span className="cs-label">ANTES DE COMEÇAR</span><h2>Sem letra miúda.<br /><em>Só respostas.</em></h2><p>O básico, explicado como deveria ser.</p></div>
          <div className="cs-faq-list">
            <details><summary>Preciso de certificado digital?<span>+</span></summary><p>Sim. Você envia seu certificado A1 (.pfx), o mesmo usado no e-CAC. Ele fica criptografado e é usado apenas para assinar suas notas.</p></details>
            <details><summary>E se a prefeitura sair do ar?<span>+</span></summary><p>A emissão entra em uma fila segura e é retomada automaticamente quando o sistema municipal voltar.</p></details>
            <details><summary>Posso cancelar uma nota?<span>+</span></summary><p>Sim. Você pode pedir o cancelamento pelo assistente. Reembolsos no AbacatePay também cancelam a nota automaticamente.</p></details>
            <details><summary>Vocês são do AbacatePay?<span>+</span></summary><p>Não. O açaínfe é independente e foi feito para conectar pagamentos do AbacatePay à emissão de NFS-e.</p></details>
          </div>
        </section>

        <section className="cs-close" id="comece">
          <span className="cs-label">PAGUE PELO QUE ACONTECE</span>
          <h2>Seu próximo pagamento<br />já pode virar <em>nota.</em></h2>
          <p>Configure uma vez. Depois, a venda aprovada faz o resto.</p>
          <a className="cs-primary cs-primary--light" href="/app">Começar agora <span>↗</span></a>
          <small>Sem mensalidade. Sem taxa de adesão.</small>
        </section>
      </main>
      <footer className="cs-footer"><a href="#inicio" className="cs-wordmark">aça<span>í</span>nfe<i /></a><span>Emissão de NFS-e que acompanha suas vendas.</span><a href="#duvidas">Ajuda e dúvidas ↑</a><small>Produto independente. Não afiliado ao AbacatePay.</small></footer>
    </div>
  );
}
