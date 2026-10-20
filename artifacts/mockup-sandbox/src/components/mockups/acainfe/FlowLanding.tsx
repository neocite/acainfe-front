import { useMemo, useState } from "react";
import "./flowlanding.css";

const faqs = [
  ["Preciso de certificado digital?", "Sim, o A1 (arquivo .pfx), o mesmo usado no e-CAC. Ele fica criptografado e só serve para assinar suas notas."],
  ["Minha cidade já é atendida?", "No momento, atendemos São Bernardo do Campo (SP), para empresas do Simples Nacional e MEI. Você pode se cadastrar para entrar na lista de espera da sua cidade."],
  ["Preciso entender de imposto?", "Não. O assistente explica cada escolha em português claro e você só confirma. Na dúvida, mostre ao seu contador: tudo fica registrado."],
  ["E se a prefeitura sair do ar?", "A nota entra na fila e sai sozinha quando o sistema voltar."],
  ["Posso cancelar uma nota?", "Pode, pelo assistente. Reembolsos no AbacatePay cancelam a nota automaticamente."],
  ["E se eu não vender nada no mês?", "Você não paga nada. Não existe mensalidade, adesão nem plano: a cobrança é só por nota emitida."],
  ["Como sou cobrado?", "R$ 0,80 por nota emitida com sucesso. Notas rejeitadas pela prefeitura não são cobradas."],
  ["Vocês são do AbacatePay ou da Hotmart?", "Não. O açaínfe é um produto independente, feito para quem vende pelo AbacatePay e pela Hotmart."],
];

const features = [
  ["01", "Nota diferente por produto", "Curso, mentoria e consultoria têm códigos de serviço diferentes. A gente emite certo, item por item."],
  ["02", "Prefeitura fora do ar? Problema nosso", "A venda fica na fila e a nota sai assim que o sistema voltar. Sem nota perdida, sem nota duplicada."],
  ["03", "Estornou? Cancelou", "Reembolso no AbacatePay cancela a nota automaticamente."],
  ["04", "Assinaturas também", "Cada renovação gera a nota do mês."],
  ["05", "Seu logo na nota", "O PDF sai com a sua marca."],
  ["06", "Opera pelo seu assistente de IA", "Emita, consulte, reenvie e cancele conversando. Funciona com Claude e outros clientes MCP."],
];

const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default function FlowLanding() {
  const [volume, setVolume] = useState(48);
  const [average, setAverage] = useState(197);
  const monthly = volume * 0.8;
  const ratio = useMemo(
    () => ((monthly / Math.max(1, volume * average)) * 100).toFixed(2).replace(".", ","),
    [monthly, volume, average],
  );

  return (
    <div className="fl-page" id="top">
      <header className="fl-header">
        <a className="fl-brand" href="#top" aria-label="açaínfe, início">aça<span>í</span>nfe<sup>®</sup></a>
        <nav aria-label="Navegação principal">
          <a href="#como">Como funciona</a>
          <a href="#simule">Calculadora</a>
          <a href="#perguntas">Perguntas</a>
        </nav>
        <a className="fl-login" href="/app">Entrar <span>↗</span></a>
      </header>

      <main>
        <section className="fl-hero">
          <div className="fl-hero-rail"><span>NFSe / 001</span><i /> <span>EMISSÃO AUTOMÁTICA</span></div>
          <div className="fl-hero-copy">
            <p className="fl-kicker"><b /> Para quem vende no AbacatePay e na Hotmart</p>
            <h1>Você vende.<br /><em>A nota acontece.</em></h1>
            <p className="fl-intro">Cada pagamento aprovado vira uma NFS-e, enviada ao cliente por e-mail e WhatsApp. Sem tarefa no fim do dia. Sem mensalidade no mês quieto.</p>
            <div className="fl-hero-actions">
              <a className="fl-cta" href="/app">Começar agora <span>↗</span></a>
              <a className="fl-text-link" href="#como">Veja como funciona <span>↓</span></a>
            </div>
            <p className="fl-micro">Sem taxa de adesão. Notas rejeitadas não são cobradas.</p>
          </div>
          <aside className="fl-receipt" aria-label="Preço por nota">
            <div className="fl-receipt-top"><span>PREÇO CLARO</span><span>01 / 02</span></div>
            <div className="fl-receipt-price"><small>por nota emitida</small><strong>R$ 0,80</strong></div>
            <div className="fl-receipt-rule" />
            <div className="fl-receipt-row"><span>Mensalidade</span><strong>R$ 0,00</strong></div>
            <div className="fl-receipt-row"><span>Adesão</span><strong>R$ 0,00</strong></div>
            <div className="fl-receipt-stamp">PAGUE SÓ<br />QUANDO VENDER</div>
            <div className="fl-receipt-foot"><span>✳</span> Sem venda, sem cobrança.</div>
          </aside>
          <div className="fl-hero-bottom"><span>SAÍDA AUTOMÁTICA DE NOTAS</span><div><i /> PAGAMENTO <b>→</b> NFS-e <b>→</b> CLIENTE</div></div>
        </section>

        <section className="fl-principle">
          <span className="fl-index">01 / A IDEIA TODA</span>
          <h2>Uma venda, uma nota.<br /><em>Nenhum custo nos meses parados.</em></h2>
          <div className="fl-principle-aside">
            <span className="fl-bigzero">R$ 0</span>
            <p>se você não vendeu.<br /><strong>É só isso.</strong></p>
          </div>
          <p className="fl-principle-copy">Quem vende por lançamento conhece: uma semana forte, depois meses calmos. Você paga apenas pelas notas emitidas com sucesso — a nota só existe quando a venda existe.</p>
          <div className="fl-ticker"><span>SEM PLANO FIXO</span><b>✳</b><span>CUSTO PROPORCIONAL</span><b>✳</b><span>SEM SURPRESA</span><b>✳</b><span>SEM PLANO FIXO</span></div>
        </section>

        <section className="fl-how" id="como">
          <div className="fl-section-top"><span className="fl-index">02 / DO PAGAMENTO À NOTA</span><p>Três passos, sem enrolação.</p></div>
          <h2>Configure uma vez.<br /><em>Depois, a venda faz o resto.</em></h2>
          <div className="fl-steps">
            <article><span className="fl-step-no">01</span><div className="fl-step-symbol">⌁</div><h3>Conecte sua plataforma</h3><p>Entre e conecte AbacatePay ou Hotmart. Encontramos seus dados fiscais.</p><span className="fl-step-tag">CERTIFICADO A1</span></article>
            <article><span className="fl-step-no">02</span><div className="fl-step-symbol">⌘</div><h3>Configure seus produtos</h3><p>O assistente ajuda a escolher o código fiscal certo para cada serviço.</p><span className="fl-step-tag">AJUDA EM PORTUGUÊS CLARO</span></article>
            <article><span className="fl-step-no">03</span><div className="fl-step-symbol fl-symbol-check">✓</div><h3>Venda. A nota sai.</h3><p>Pagamento aprovado, nota emitida e enviada ao cliente por e-mail e WhatsApp.</p><span className="fl-step-tag">AUTOMÁTICO, DE VERDADE</span></article>
          </div>
        </section>

        <section className="fl-calculator" id="simule">
          <div className="fl-calc-intro">
            <span className="fl-index">03 / FAÇA A CONTA</span>
            <h2>Um mês no<br /><em>seu ritmo.</em></h2>
            <p>Faça uma estimativa rápida. A cobrança segue o que você vendeu — não o que um plano prevê.</p>
            <div className="fl-calc-note"><span>✳</span><p>Uma venda de R$ 97?<br />A nota custa menos de 1% do valor.</p></div>
          </div>
          <div className="fl-calc-panel">
            <div className="fl-panel-head"><span>SIMULADOR DE CUSTO</span><span>R$ 0,80 / NOTA</span></div>
            <label className="fl-field-label" htmlFor="fl-volume">Quantas notas você emite no mês?<strong>{volume}<small> notas</small></strong></label>
            <input id="fl-volume" className="fl-range" type="range" min="1" max="200" value={volume} onChange={(event) => setVolume(Number(event.target.value))} style={{ background: `linear-gradient(90deg, #762e68 0%, #762e68 ${volume / 2}%, #e5d6df ${volume / 2}%, #e5d6df 100%)` }} />
            <div className="fl-range-ends"><span>1</span><span>200</span></div>
            <label className="fl-field-label fl-ticket-label" htmlFor="fl-average">Valor médio da venda <span className="fl-money-input"><b>R$</b><input id="fl-average" type="number" min="1" value={average} onChange={(event) => setAverage(Math.max(1, Number(event.target.value) || 1))} /></span></label>
            <div className="fl-result">
              <div><span>ESTIMATIVA DO MÊS</span><strong>{brl(monthly)}</strong></div>
              <div className="fl-result-share"><span>DO FATURAMENTO</span><strong>{ratio}%</strong></div>
              <div className="fl-meter"><i style={{ width: `${Math.min(Number(ratio) * 5, 100)}%` }} /></div>
              <p>{volume} notas × R$ 0,80. Notas rejeitadas pela prefeitura não são cobradas.</p>
            </div>
          </div>
        </section>

        <section className="fl-benefits">
          <div className="fl-benefits-head"><span className="fl-index">04 / DETALHES QUE FAZEM DIFERENÇA</span><h2>Tudo que a nota precisa.<br /><em>Sem você lembrar.</em></h2></div>
          <div className="fl-feature-list">
            {features.map(([n, title, description]) => <article key={n}><span>{n}</span><h3>{title}</h3><p>{description}</p><b>↗</b></article>)}
          </div>
        </section>

        <section className="fl-availability">
          <div className="fl-location-index">05 / ONDE ESTAMOS</div>
          <div className="fl-location-title"><span className="fl-location-dot" /><h2>Uma cidade de cada vez.</h2><p>Com cuidado em cada nota.</p></div>
          <div className="fl-city-card"><span>DISPONÍVEL HOJE</span><strong>São Bernardo<br />do Campo <i>↗</i></strong><small>São Paulo · MEI e Simples Nacional</small></div>
          <div className="fl-availability-copy"><p>Para negócios digitais de serviço: infoprodutores, mentores, SaaS, agências, consultores e prestadores de serviço.</p><p>Em outras cidades, faça seu cadastro para entrar na lista de espera. Avisamos por e-mail e WhatsApp.</p><span>INTEGRAÇÃO COM ABACATEPAY E HOTMART · PRODUTO INDEPENDENTE</span></div>
        </section>

        <section className="fl-faq" id="perguntas">
          <div className="fl-faq-title"><span className="fl-index">06 / SEM LETRA MIÚDA</span><h2>Perguntas<br /><em>frequentes.</em></h2><p>O básico, explicado como deveria ser.</p></div>
          <div className="fl-faq-list">{faqs.map(([question, answer], index) => <details key={question}><summary><span className="fl-faq-number">{String(index + 1).padStart(2, "0")}</span>{question}<b>+</b></summary><p>{answer}</p></details>)}</div>
        </section>

        <section className="fl-close">
          <span className="fl-close-kicker">A PRÓXIMA VENDA JÁ PODE VIRAR NOTA</span>
          <h2>Não vendeu,<br /><em>não pagou.</em></h2>
          <div className="fl-close-action"><p>Vendeu? A nota já foi.<br />Sem mensalidade. Sem taxa de adesão.</p><a className="fl-cta fl-cta-light" href="/app">Começar agora <span>↗</span></a></div>
          <span className="fl-close-mark">aí</span>
        </section>
      </main>
      <footer className="fl-footer"><a className="fl-brand" href="#top">aça<span>í</span>nfe<sup>®</sup></a><p>Emissão de NFS-e que acompanha suas vendas.</p><div><a href="#perguntas">Ajuda</a><a href="/app">Entrar</a></div><small>Produto independente. Não afiliado ao AbacatePay nem à Hotmart.</small></footer>
    </div>
  );
}
