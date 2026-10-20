import { useMemo, useState } from "react";
import "./coststudiorefined.css";

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const presets = [
  { count: 12, title: "Mês tranquilo", label: "12 notas" },
  { count: 48, title: "Ritmo constante", label: "48 notas" },
  { count: 126, title: "Mês de lançamento", label: "126 notas" },
];

const steps = [
  { number: "01", title: "Conecte sua plataforma", copy: "Vincule AbacatePay ou Hotmart uma única vez." },
  { number: "02", title: "Configure seus serviços", copy: "Mapeie cada produto com ajuda do assistente." },
  { number: "03", title: "Venda. A nota vai.", copy: "Cada pagamento aprovado dispara a emissão." },
];

export default function CostStudioRefined() {
  const [invoices, setInvoices] = useState(48);
  const [ticket, setTicket] = useState(197);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const feePerInvoice = 0.8;
  const total = invoices * feePerInvoice;
  const revenue = invoices * ticket;
  const share = revenue > 0 ? ((total / revenue) * 100).toFixed(2).replace(".", ",") : "0,00";
  const progress = useMemo(() => Math.max(0, Math.min(100, (invoices / 200) * 100)), [invoices]);

  return (
    <div className="csr-page" id="inicio">
      <header className="csr-nav">
        <a href="#inicio" className="csr-logo" aria-label="açaínfe, início">aça<span>í</span>nfe<i /></a>
        <nav aria-label="Navegação principal">
          <a href="#simulador">Simulador</a>
          <a href="#como-funciona">Como funciona</a>
          <a href="#disponibilidade">Disponibilidade</a>
          <a href="#duvidas">Dúvidas</a>
        </nav>
        <a className="csr-nav-link" href="/app">Entrar <span aria-hidden="true">↗</span></a>
      </header>

      <main>
        <section className="csr-hero">
          <div className="csr-hero-copy">
            <div className="csr-eyebrow"><span className="csr-status-dot" /> NOTA FISCAL NO AUTOMÁTICO</div>
            <p className="csr-kicker">Para quem vende no digital</p>
            <h1>Vendeu.<br /><em>A nota foi.</em></h1>
            <p className="csr-lead">Cada pagamento aprovado no AbacatePay ou na Hotmart vira uma NFS-e — sem planilha no fim do mês, sem mensalidade nos meses quietos.</p>
            <div className="csr-hero-actions">
              <a className="csr-button" href="/app">Começar agora <span aria-hidden="true">↗</span></a>
              <a className="csr-text-link" href="#como-funciona">Ver como funciona <span aria-hidden="true">↓</span></a>
            </div>
            <div className="csr-proofline"><span className="csr-check">✓</span><span><strong>R$ 0,80</strong> por nota emitida com sucesso</span><span className="csr-proof-divider" /><span>Sem taxa fixa</span></div>
          </div>

          <section className="csr-calculator" id="simulador" aria-labelledby="csr-calc-title">
            <div className="csr-calc-top">
              <div>
                <span className="csr-label">SIMULADOR DE CUSTO</span>
                <h2 id="csr-calc-title">Um mês na sua operação</h2>
              </div>
              <span className="csr-calc-index">01 <i>—</i> 03</span>
            </div>

            <label className="csr-range-title" htmlFor="csr-invoices"><span>Notas emitidas</span><strong>{invoices}<small> / mês</small></strong></label>
            <input
              id="csr-invoices"
              className="csr-range"
              type="range"
              min="1"
              max="200"
              value={invoices}
              style={{ background: `linear-gradient(90deg, #8c4b79 0%, #8c4b79 ${progress}%, #e7dcd7 ${progress}%, #e7dcd7 100%)` }}
              onChange={(event) => setInvoices(Number(event.target.value))}
              aria-label="Quantidade de notas emitidas por mês"
            />
            <div className="csr-range-ends"><span>1 nota</span><span>200 notas</span></div>

            <div className="csr-presets" aria-label="Exemplos de volume mensal">
              {presets.map((preset) => (
                <button
                  key={preset.count}
                  type="button"
                  className={invoices === preset.count ? "is-active" : ""}
                  aria-pressed={invoices === preset.count}
                  onClick={() => setInvoices(preset.count)}
                >
                  <b>{preset.title}</b><span>{preset.label}</span>
                </button>
              ))}
            </div>

            <div className="csr-ticket-row">
              <label htmlFor="csr-ticket">Valor médio por venda</label>
              <div className="csr-money-input"><span>R$</span><input id="csr-ticket" type="number" min="1" max="99999" value={ticket} onChange={(event) => setTicket(Math.max(1, Number(event.target.value) || 1))} /></div>
            </div>

            <div className="csr-result" aria-live="polite">
              <div className="csr-result-main"><span>Seu custo estimado neste mês</span><strong>{formatBRL(total)}</strong></div>
              <div className="csr-result-meta"><span>Sem mensalidade</span><b>R$ 0,80 <small>/ nota</small></b></div>
              <div className="csr-meter" aria-hidden="true"><span style={{ width: `${Math.max(2, Math.min(Number(share) * 5, 100))}%` }} /></div>
              <p>Isso representa <strong>{share}%</strong> do faturamento estimado de {formatBRL(revenue)}.</p>
            </div>

            <button className="csr-disclosure" type="button" onClick={() => setDetailsOpen((open) => !open)} aria-expanded={detailsOpen}>
              <span>{detailsOpen ? "Fechar detalhes do cálculo" : "Como calculamos seu custo"}</span><b>{detailsOpen ? "−" : "+"}</b>
            </button>
            {detailsOpen && <p className="csr-explanation">{invoices} notas × R$ 0,80 por emissão concluída. Notas rejeitadas pela prefeitura não são cobradas. Sem adesão e sem mensalidade.</p>}
          </section>

          <div className="csr-hero-foot"><span>UMA CONTA SIMPLES, SEM SURPRESAS</span><a href="#simulador">Arraste para simular <b>↘</b></a></div>
        </section>

        <section className="csr-equation" aria-label="Modelo de cobrança">
          <span>O volume muda.</span><strong>R$ 0 fixos <i>+</i> R$ 0,80 por nota</strong><span>O custo acompanha suas vendas.</span>
        </section>

        <section className="csr-process" id="como-funciona">
          <div className="csr-section-head">
            <div><span className="csr-label">DO PAGAMENTO À NOTA</span><h2>Você cuida da venda.<br /><em>A gente fecha o ciclo.</em></h2></div>
            <p>Uma configuração inicial. Depois, cada pagamento aprovado segue o fluxo automaticamente.</p>
          </div>
          <div className="csr-steps">
            {steps.map((step) => (
              <article key={step.number}>
                <div className="csr-step-top"><span>{step.number}</span><i aria-hidden="true">↗</i></div>
                <h3>{step.title}</h3><p>{step.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="csr-zero">
          <span className="csr-zero-mark" aria-hidden="true">“</span>
          <div><span className="csr-label">E NOS MESES SEM VENDA?</span><h2>O custo também<br />fica em <em>pausa.</em></h2></div>
          <div className="csr-zero-note"><strong>R$ 0</strong><p>Sem venda, sem nota.<br /><b>Sem nota, sem cobrança.</b></p></div>
        </section>

        <section className="csr-availability" id="disponibilidade">
          <div className="csr-availability-copy"><span className="csr-label">DISPONÍVEL HOJE</span><h2>Uma cidade de cada vez.<br /><em>Com cuidado em cada nota.</em></h2><p>Atendimento atual para MEI e empresas do Simples Nacional. Estamos ampliando a cobertura municipal.</p></div>
          <div className="csr-city-card"><span className="csr-pin" aria-hidden="true">◎</span><div><strong>São Bernardo do Campo</strong><span>São Paulo · MEI e Simples Nacional</span></div><span className="csr-active">ATIVO</span></div>
          <a href="/app" className="csr-availability-link">Ver disponibilidade para minha empresa <span aria-hidden="true">↗</span></a>
          <p className="csr-independent">Produto independente, não afiliado ao AbacatePay ou à Hotmart.</p>
        </section>

        <section className="csr-faq" id="duvidas">
          <div className="csr-faq-intro"><span className="csr-label">ANTES DE COMEÇAR</span><h2>Sem letra miúda.<br /><em>Só respostas.</em></h2><p>O essencial, explicado sem rodeios.</p></div>
          <div className="csr-faq-list">
            <details><summary>Preciso de certificado digital?<span>+</span></summary><p>Sim. Você envia seu certificado A1 (.pfx), o mesmo usado no e-CAC. Ele fica criptografado e é usado apenas para assinar suas notas.</p></details>
            <details><summary>E se a prefeitura sair do ar?<span>+</span></summary><p>A emissão entra em uma fila e é retomada automaticamente quando o sistema municipal voltar.</p></details>
            <details><summary>Posso cancelar uma nota?<span>+</span></summary><p>Sim. Você pode solicitar o cancelamento pelo assistente. Reembolsos no AbacatePay também cancelam a nota automaticamente.</p></details>
            <details><summary>Como sou cobrado?<span>+</span></summary><p>R$ 0,80 por nota emitida com sucesso. Notas rejeitadas pela prefeitura não são cobradas.</p></details>
            <details><summary>Vocês são do AbacatePay ou da Hotmart?<span>+</span></summary><p>Não. O açaínfe é independente e conecta pagamentos aprovados à emissão de NFS-e.</p></details>
          </div>
        </section>

        <section className="csr-close" id="comece">
          <span className="csr-label">PAGUE PELO QUE ACONTECE</span>
          <h2>Seu próximo pagamento<br />já pode virar <em>nota.</em></h2>
          <p>Configure uma vez. Depois, a venda aprovada faz o resto.</p>
          <a className="csr-button csr-button-light" href="/app">Começar agora <span aria-hidden="true">↗</span></a>
          <small>Sem mensalidade. Sem taxa de adesão.</small>
        </section>
      </main>

      <footer className="csr-footer"><a href="#inicio" className="csr-logo">aça<span>í</span>nfe<i /></a><span>Emissão de NFS-e que acompanha suas vendas.</span><a href="#duvidas">Ajuda e dúvidas ↑</a><small>O açaínfe não é afiliado ao AbacatePay nem à Hotmart.</small></footer>
    </div>
  );
}
