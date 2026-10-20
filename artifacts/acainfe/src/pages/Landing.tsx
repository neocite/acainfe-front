import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { brl } from '@/config/pricing';
import { usePricing } from '@/components/landing/use-pricing';
import { Calculator } from '@/components/landing/Calculator';
import { StudioCalculator } from '@/components/landing/StudioCalculator';
import { LegalModal, SUPPORT_EMAIL, type LegalKind } from '@/components/landing/Legal';
import './landing-studio.css';

const NAV = [
  ['#simulador', 'Simulador'], ['#como-funciona', 'Como funciona'],
  ['#disponibilidade', 'Disponibilidade'], ['#duvidas', 'Dúvidas'],
] as const;

function setMeta(sel: string, attr: string, key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(sel);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', value);
}

export default function Landing() {
  const { pricePerInvoiceCents: price, monthlyFeeCents: fee } = usePricing();
  const [legal, setLegal] = useState<LegalKind | null>(null);
  const [invoices, setInvoices] = useState(48);
  const [compareOpen, setCompareOpen] = useState(false);
  const comparison = useRef<HTMLDialogElement>(null);
  const P = brl(price);

  useEffect(() => {
    const title = 'açaínfe: nota fiscal automática, sem mensalidade, para quem vende no AbacatePay e na Hotmart';
    const desc = `Não vendeu? Não pagou. NFS-e automática para vendas no AbacatePay e na Hotmart, por ${P} por nota, sem mensalidade.`;
    const origin = window.location.origin;
    document.title = title;
    document.documentElement.lang = 'pt-BR';
    setMeta('meta[name="description"]', 'name', 'description', desc);
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', desc);
    setMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
    setMeta('meta[property="og:locale"]', 'property', 'og:locale', 'pt_BR');
    setMeta('meta[property="og:image"]', 'property', 'og:image', `${origin}/api/og.png`);
    setMeta('meta[property="og:image:width"]', 'property', 'og:image:width', '1200');
    setMeta('meta[property="og:image:height"]', 'property', 'og:image:height', '630');
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', desc);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', `${origin}/api/og.png`);
  }, [P]);

  const faq = [
    { q: 'Preciso de certificado digital?', a: 'Sim, o A1 (arquivo .pfx), o mesmo usado no e-CAC. Ele fica criptografado e só serve para assinar suas notas.' },
    { q: 'Minha cidade já é atendida?', a: 'No momento, atendemos São Bernardo do Campo (SP), para empresas do Simples Nacional e MEI. Você pode se cadastrar para entrar na lista de espera da sua cidade.' },
    { q: 'Preciso entender de imposto?', a: 'Não. O assistente explica cada escolha em português claro e você só confirma. Na dúvida, mostre ao seu contador: tudo fica registrado.' },
    { q: 'E se a prefeitura sair do ar?', a: 'A nota entra na fila e sai sozinha quando o sistema voltar.' },
    { q: 'Posso cancelar uma nota?', a: 'Pode, pelo assistente. Reembolsos no AbacatePay cancelam a nota automaticamente.' },
    { q: 'E se eu não vender nada no mês?', a: 'Você não paga nada. Não existe mensalidade, adesão nem plano: a cobrança é só por nota emitida.' },
    { q: 'Como sou cobrado?', a: `${P} por nota emitida com sucesso. Notas rejeitadas pela prefeitura não são cobradas.` },
    { q: 'Vocês são do AbacatePay ou da Hotmart?', a: 'Não. O açaínfe é um produto independente, feito para quem vende pelo AbacatePay e pela Hotmart.' },
  ];

  const steps = [
    { number: '01', title: 'Conecte sua plataforma', copy: 'Vincule AbacatePay ou Hotmart uma única vez.' },
    { number: '02', title: 'Configure seus serviços', copy: 'Mapeie cada produto com ajuda do assistente.' },
    { number: '03', title: 'Venda. A nota vai.', copy: 'Cada pagamento aprovado dispara a emissão.' },
  ];
  return (
    <div className="csr-page" id="inicio">
      <header className="csr-nav">
        <a href="#inicio" className="csr-logo" aria-label="açaínfe, início">aça<span>í</span>nfe<i /></a>
        <nav aria-label="Navegação principal">{NAV.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav>
        <Link className="csr-nav-link" href="/app">Entrar <span aria-hidden="true">↗</span></Link>
      </header>
      <main>
        <section className="csr-hero">
          <div className="csr-hero-copy">
            <div className="csr-eyebrow"><span className="csr-status-dot" /> NOTA FISCAL NO AUTOMÁTICO</div>
            <p className="csr-kicker">Para quem vende no digital</p>
            <h1>Vendeu.<br /><em>A nota foi.</em></h1>
            <p className="csr-lead">Cada pagamento aprovado no AbacatePay ou na Hotmart vira uma NFS-e — sem planilha no fim do mês, {fee === 0 ? 'sem mensalidade nos meses quietos.' : 'com cobrança transparente.'}</p>
            <div className="csr-hero-actions">
              <Link className="csr-button" href="/app">Começar agora <span aria-hidden="true">↗</span></Link>
              <a className="csr-text-link" href="#como-funciona">Ver como funciona <span aria-hidden="true">↓</span></a>
            </div>
            <div className="csr-proofline"><span className="csr-check" aria-hidden="true">✓</span><span><strong>{P}</strong> por nota emitida com sucesso</span><span className="csr-proof-divider" /><span>{fee === 0 ? 'Sem taxa fixa' : `${brl(fee)} por mês`}</span></div>
          </div>
          <StudioCalculator price={price} monthlyFee={fee} invoices={invoices} onInvoicesChange={setInvoices} onCompare={() => {
            setCompareOpen(true);
            comparison.current?.showModal();
          }} />
          <div className="csr-hero-foot"><span>UMA CONTA SIMPLES, SEM SURPRESAS</span><a href="#simulador">Arraste para simular <b aria-hidden="true">↘</b></a></div>
        </section>
        <section className="csr-equation" aria-label="Modelo de cobrança">
          <span>O volume muda.</span><strong>{fee === 0 ? 'R$ 0' : brl(fee)} fixos <i>+</i> {P} por nota</strong><span>O custo acompanha suas vendas.</span>
        </section>
        <section className="csr-process" id="como-funciona">
          <div className="csr-section-head">
            <div><span className="csr-label">DO PAGAMENTO À NOTA</span><h2>Você cuida da venda.<br /><em>A gente fecha o ciclo.</em></h2></div>
            <p>Uma configuração inicial. Depois, cada pagamento aprovado segue o fluxo automaticamente.</p>
          </div>
          <div className="csr-steps">{steps.map((step) => <article key={step.number}>
            <div className="csr-step-top"><span>{step.number}</span><i aria-hidden="true">↗</i></div>
            <h3>{step.title}</h3><p>{step.copy}</p>
          </article>)}</div>
        </section>
        <section className="csr-zero" id="so-paga-se-vender">
          <span className="csr-zero-mark" aria-hidden="true">“</span>
          <div><span className="csr-label">E NOS MESES SEM VENDA?</span><h2>O custo também<br />fica em <em>pausa.</em></h2></div>
          <div className="csr-zero-note"><strong>{fee === 0 ? 'R$ 0' : brl(fee)}</strong><p>Sem venda, sem nota.<br /><b>{fee === 0 ? 'Sem nota, sem cobrança.' : 'Só a mensalidade, sem emissões.'}</b></p></div>
        </section>
        <section className="csr-availability" id="disponibilidade">
          <span id="compatibilidade" />
          <div className="csr-availability-copy"><span className="csr-label">DISPONÍVEL HOJE</span><h2>Uma cidade de cada vez.<br /><em>Com cuidado em cada nota.</em></h2><p>Atendimento atual para MEI e empresas do Simples Nacional. Estamos ampliando a cobertura municipal. Em outras cidades, cadastre-se para entrar na lista de espera.</p></div>
          <div className="csr-city-card"><span className="csr-pin" aria-hidden="true">◎</span><div><strong>São Bernardo do Campo</strong><span>São Paulo · MEI e Simples Nacional</span></div><span className="csr-active">ATIVO</span></div>
          <Link href="/app" className="csr-availability-link">Ver disponibilidade para minha empresa <span aria-hidden="true">↗</span></Link>
          <p className="csr-independent">Produto independente, não afiliado ao AbacatePay ou à Hotmart.</p>
        </section>
        <section className="csr-faq" id="duvidas">
          <span id="faq" className="csr-anchor" />
          <div className="csr-faq-intro"><span className="csr-label">ANTES DE COMEÇAR</span><h2>Sem letra miúda.<br /><em>Só respostas.</em></h2><p>O essencial, explicado sem rodeios.</p></div>
          <div className="csr-faq-list">{faq.map(({ q, a }) => <details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div>
        </section>
        <section className="csr-close" id="comece">
          <span className="csr-label">PAGUE PELO QUE ACONTECE</span>
          <h2>Seu próximo pagamento<br />já pode virar <em>nota.</em></h2>
          <p>Configure uma vez. Depois, a venda aprovada faz o resto.</p>
          <Link className="csr-button csr-button-light" href="/app">Começar agora <span aria-hidden="true">↗</span></Link>
          <small>{fee === 0 ? 'Sem mensalidade. ' : ''}Sem taxa de adesão.</small>
        </section>
      </main>
      <footer className="csr-footer">
        <a href="#inicio" className="csr-logo" aria-label="açaínfe, início">aça<span>í</span>nfe<i /></a>
        <span>Emissão de NFS-e que acompanha suas vendas.</span><a href="#duvidas">Ajuda e dúvidas ↑</a>
        <div className="csr-company">
          <span>O açaínfe é uma marca da Extractify.</span>
          <span>CNPJ: 28.095.894/0001-60</span>
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </div>
        <div className="csr-footer-legal">
          <button type="button" onClick={() => setLegal('termos')}>Termos de uso</button>
          <button type="button" onClick={() => setLegal('privacidade')}>Política de privacidade</button>
          <button type="button" onClick={() => setLegal('contato')}>Contato</button>
        </div>
        <small>O açaínfe não é afiliado ao AbacatePay nem à Hotmart.</small>
      </footer>
      <dialog ref={comparison} className="csr-comparison-dialog" aria-label="Comparação de planos e fontes" onClose={() => {
        // O evento nativo de fechamento pode chegar depois de uma reabertura rápida.
        if (!comparison.current?.open) setCompareOpen(false);
      }} onClick={(event) => {
        if (event.target !== comparison.current) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) comparison.current?.close();
      }}>
        <div className="csr-comparison-close"><button type="button" onClick={() => comparison.current?.close()}>Fechar comparação ×</button></div>
        <div id="comparador">{compareOpen && <Calculator price={price} initialNotes={invoices} />}</div>
      </dialog>
      <LegalModal kind={legal} onClose={() => setLegal(null)} />
    </div>
  );
}
