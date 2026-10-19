import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Bot, Check, CloudOff, KeyRound, Layers, Menu, MessageCircle, Palette, Plug, Repeat, Undo2, X } from 'lucide-react';
import { brl } from '@/config/pricing';
import { usePricing } from '@/components/landing/use-pricing';
import { Reveal } from '@/components/landing/Reveal';
import { Bowl, ChatCard, HandArrow, Logo, Squiggle } from '@/components/landing/Art';
import { Calculator } from '@/components/landing/Calculator';
import { Comparison } from '@/components/landing/Comparison';
import { Faq } from '@/components/landing/Faq';
import { LegalModal, type LegalKind } from '@/components/landing/Legal';

const NAV = [
  ['#como-funciona', 'Como funciona'], ['#so-paga-se-vender', 'Só paga se vender'], ['#preco', 'Preço'], ['#comparativo', 'Comparativo'], ['#faq', 'FAQ'],
] as const;

function setMeta(sel: string, attr: string, key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(sel);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', value);
}

function Cta({ size = 'lg', children = 'Começar grátis', micro = true }: { size?: 'lg' | 'sm'; children?: ReactNode; micro?: boolean }) {
  return (
    <div>
      <Link href="/app" className={`ac-btn ac-btn--manga ${size === 'lg' ? 'ac-btn--lg' : 'ac-btn--sm'}`}>{children}<ArrowRight size={size === 'lg' ? 20 : 16} /></Link>
      {micro && <p className="ac-micro">Sem mensalidade. Não vendeu, não pagou.</p>}
    </div>
  );
}

export default function Landing() {
  const { pricePerInvoiceCents: price, monthlyFeeCents: fee } = usePricing();
  const [menu, setMenu] = useState(false);
  const [legal, setLegal] = useState<LegalKind | null>(null);
  const P = brl(price);
  const pct = (price / 9700) * 100;
  const pctText = pct < 1 ? 'menos de 1%' : `cerca de ${pct.toFixed(1).replace('.', ',')}%`;

  useEffect(() => {
    const title = 'açaínfe: nota fiscal automática, sem mensalidade, para quem vende no AbacatePay';
    const desc = `Não vendeu? Não pagou. NFS-e automática a cada venda no AbacatePay, por ${P} por nota, sem mensalidade.`;
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

  const closeMenu = () => setMenu(false);

  const faq = [
    { q: 'Preciso de certificado digital?', a: 'Sim, o A1 (arquivo .pfx), o mesmo usado no e-CAC. Ele fica criptografado e só serve para assinar suas notas.' },
    { q: 'Minha cidade já é atendida?', a: 'Começamos por São Bernardo do Campo (Simples Nacional e MEI). Cadastre-se para entrar na lista de espera da sua cidade.' },
    { q: 'Preciso entender de imposto?', a: 'Não. O assistente explica cada escolha em português claro e você só confirma. Na dúvida, mostre ao seu contador: tudo fica registrado.' },
    { q: 'E se a prefeitura sair do ar?', a: 'A nota entra na fila e sai sozinha quando o sistema voltar.' },
    { q: 'Posso cancelar uma nota?', a: 'Pode, pelo assistente. Reembolsos no AbacatePay cancelam a nota automaticamente.' },
    { q: 'E se eu não vender nada no mês?', a: 'Você não paga nada. Não existe mensalidade, adesão nem plano: a cobrança é só por nota emitida.' },
    { q: 'Como sou cobrado?', a: `${P} por nota emitida com sucesso. Notas rejeitadas pela prefeitura não são cobradas.` },
    { q: 'Vocês são do AbacatePay?', a: 'Não. O açaínfe é um produto independente, feito para quem vende pelo AbacatePay.' },
  ];

  const steps = [
    { Ic: KeyRound, t: 'Entre com o Google e envie seu certificado A1.', d: 'A gente descobre seu CNPJ, sua cidade e suas atividades sozinho.' },
    { Ic: Plug, t: 'Conecte o AbacatePay com uma chave.', d: 'Criamos o webhook e importamos seus produtos. Zero configuração manual.' },
    { Ic: MessageCircle, t: 'Converse com a IA uma vez.', d: 'Ela te ajuda a definir como cada produto é tributado. Depois disso, cada venda vira nota sozinha.' },
  ];
  const bens = [
    { c: 'ac-b1', Ic: Layers, t: 'Nota diferente por produto', d: 'Curso, mentoria e consultoria têm códigos de serviço diferentes. A gente emite certo, item por item.' },
    { c: 'ac-b2 ac-ben--manga', Ic: CloudOff, t: 'Prefeitura fora do ar? Problema nosso', d: 'A venda fica na fila e a nota sai assim que o sistema voltar. Sem nota perdida, sem nota duplicada.' },
    { c: 'ac-b3', Ic: Undo2, t: 'Estornou? Cancelou', d: 'Reembolso no AbacatePay cancela a nota automaticamente.' },
    { c: 'ac-b4', Ic: Repeat, t: 'Assinaturas também', d: 'Cada renovação gera a nota do mês.' },
    { c: 'ac-b5', Ic: Palette, t: 'Seu logo na nota', d: 'O PDF sai com a sua marca.' },
    { c: 'ac-b6 ac-ben--dark', Ic: Bot, t: 'Opera pelo seu assistente de IA', d: 'Emita, consulte, reenvie e cancele conversando. Funciona com Claude e outros clientes MCP.' },
  ];
  const checks = ['Sem mensalidade', 'Sem taxa de adesão', 'Sem plano anual', 'Sem limite de notas', 'Envio por e-mail e WhatsApp incluso', 'Cancelamento e estorno inclusos', 'Acesso pelo MCP incluso'];

  return (
    <div className="ac-page">
      <header className="ac-nav">
        <div className="ac-container ac-nav__row">
          <Link href="/" aria-label="açaínfe, início"><Logo /></Link>
          <nav className="ac-nav__links" aria-label="Seções">
            {NAV.map(([h, l]) => <a key={h} href={h}>{l}</a>)}
          </nav>
          <div className="ac-nav__right">
            <Link href="/app" className="ac-btn ac-btn--ghost ac-btn--sm">Entrar</Link>
            <Link href="/app" className="ac-btn ac-btn--manga ac-btn--sm">Começar grátis</Link>
          </div>
          <button className="ac-burger" aria-label={menu ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            {menu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        <div className={`ac-mnav ${menu ? 'is-open' : ''}`} aria-hidden={!menu}>
          <div>
            {NAV.map(([h, l]) => <a key={h} className="l" href={h} onClick={closeMenu} tabIndex={menu ? 0 : -1}>{l}</a>)}
            <div style={{ padding: 20, display: 'grid', gap: 10 }}>
              <Link href="/app" className="ac-btn ac-btn--ghost" tabIndex={menu ? 0 : -1}>Entrar</Link>
              <Link href="/app" className="ac-btn ac-btn--manga" tabIndex={menu ? 0 : -1}>Começar grátis</Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="ac-hero">
          <div className="ac-container ac-hero__grid">
            <div>
              <span className="ac-pill" style={{ marginBottom: 22 }}>Preço de lançamento: {P} por nota</span>
              <h1><span>Não vendeu?</span><span className="ac-underline">Não pagou.<Squiggle /></span></h1>
              <p className="ac-hero__sub">
                Nota fiscal de serviço automática para quem vende no AbacatePay. Cada pagamento aprovado vira NFS-e, enviada ao seu cliente por e-mail e WhatsApp. <strong>Sem mensalidade: você só paga {P} quando vende.</strong>
              </p>
              <div className="ac-stat-row">
                <div className="ac-note"><span>nada de mensalidade!</span><HandArrow /></div>
                <div className="ac-stat ac-stat--zero"><small>Mês sem vendas</small><b>→ {brl(0)}</b></div>
                <div className="ac-stat"><small>Mês de lançamento com 150 vendas</small><b>→ {brl(150 * price)}</b></div>
              </div>
              <div style={{ marginTop: 28 }}><Cta /></div>
            </div>
            <div className="ac-stage">
              <div className="ac-stage__blob" aria-hidden="true" />
              <Bowl />
              <ChatCard />
            </div>
          </div>
        </section>

        <section className="ac-section ac-soft" id="so-paga-se-vender">
          <div className="ac-container">
            <Reveal>
              <span className="ac-eyebrow">a ideia toda</span>
              <h2 className="ac-h2" style={{ maxWidth: '18ch', margin: '8px 0 20px' }}>Mensalidade cobra até no mês que você <span className="ac-hl-bg">não vendeu nada</span>.</h2>
              <p className="ac-lead">Quem vende por lançamento conhece: uma semana de vendas fortes e depois meses calmos. Quem está começando nem sabe se vai vender. Com mensalidade, você paga o ano inteiro. No açaínfe, você paga só nas notas que emitiu, porque a nota só existe quando a venda existe.</p>
            </Reveal>
            <div className="ac-args">
              {[
                ['0', 'Risco zero para começar', 'Lançou o primeiro produto? Não precisa assumir um custo fixo antes da primeira venda.'],
                ['x', 'Feito para lançamentos', 'Vendeu muito numa semana e pouco no resto do mês? Você paga pelo que vendeu, não por um plano.'],
                ['%', 'Custo proporcional', `Numa venda de R$ 97, a nota custa ${pctText} do valor. Em mês fraco, a mensalidade pesa muito mais por venda.`],
              ].map(([n, t, d], i) => (
                <Reveal key={t} delay={i * 100}><div className="ac-card ac-arg" style={{ height: '100%' }}><div className="n" aria-hidden="true">{n}</div><h3>{t}</h3><p>{d}</p></div></Reveal>
              ))}
            </div>
            <Reveal><Calculator price={price} fee={fee} /></Reveal>
          </div>
        </section>

        <section className="ac-section" id="como-funciona">
          <div className="ac-container">
            <Reveal><span className="ac-eyebrow">três passos, sem enrolação</span><h2 className="ac-h2" style={{ margin: '8px 0' }}>Como funciona</h2></Reveal>
            <div className="ac-steps">
              {steps.map(({ Ic, t, d }, i) => (
                <Reveal key={t} delay={i * 120}>
                  <div className="ac-step">
                    <div className="ac-step__ic"><Ic size={26} /><em>{i + 1}</em></div>
                    <div><h3>{t}</h3><p>{d}</p></div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="ac-section" style={{ paddingTop: 0 }}>
          <div className="ac-container">
            <Reveal><h2 className="ac-h2" style={{ maxWidth: '16ch' }}>Tudo que a nota precisa, <span className="ac-hl-bg">sem você lembrar</span>.</h2></Reveal>
            <div className="ac-bento">
              {bens.map(({ c, Ic, t, d }, i) => (
                <Reveal key={t} className={c.split(' ')[0]} delay={(i % 3) * 90}>
                  <div className={`ac-card ac-ben ${c.split(' ').slice(1).join(' ')}`} style={{ height: '100%' }}>
                    <div className="ic"><Ic size={22} /></div><h3>{t}</h3><p>{d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="ac-section ac-soft">
          <div className="ac-container">
            <Reveal>
              <span className="ac-eyebrow">para quem é</span>
              <h2 className="ac-h2" style={{ margin: '8px 0' }}>Feito para quem vende por conta própria.</h2>
              <div className="ac-chips">{['Infoprodutores', 'Mentores', 'SaaS e micro-SaaS', 'Agências', 'Consultores', 'Prestadores de serviço'].map((c) => <span className="ac-chip" key={c}>{c}</span>)}</div>
              <p className="ac-avail">Começamos por <strong>São Bernardo do Campo (SP)</strong> para empresas do <strong>Simples Nacional e MEI</strong>. Sua cidade ainda não está liberada? Cadastre-se mesmo assim: você entra na lista de espera e a gente te avisa por e-mail e WhatsApp assim que liberar.</p>
            </Reveal>
          </div>
        </section>

        <section className="ac-section" id="preco">
          <div className="ac-container ac-price-wrap">
            <Reveal className="w-full" >
              <div className="ac-price" style={{ margin: '0 auto' }}>
                <span className="ac-price__seal">Preço de lançamento</span>
                <div className="ac-price__v">{P} <small>por nota</small></div>
                <ul className="ac-checks">{checks.map((c) => <li key={c}><span className="ck"><Check size={14} strokeWidth={3} /></span>{c}</li>)}</ul>
                <p className="ac-zero">Emitiu 0 notas no mês? <strong>Pagou R$ 0.</strong></p>
                <div style={{ marginTop: 28, display: 'grid', justifyItems: 'center' }}><Cta micro={false} /><p className="ac-micro" style={{ color: 'rgba(255,248,238,.7)' }}>Sem mensalidade. Não vendeu, não pagou.</p></div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="ac-section" id="comparativo" style={{ paddingTop: 0 }}>
          <div className="ac-container">
            <Reveal><h2 className="ac-h2">Mensalidade é coisa do passado.</h2></Reveal>
            <Comparison price={price} monthlyFee={fee} />
          </div>
        </section>

        <section className="ac-section ac-soft">
          <div className="ac-container">
            <Reveal>
              <span className="ac-eyebrow">integração</span>
              <h2 className="ac-h2" style={{ maxWidth: '20ch', margin: '8px 0' }}>Feito para quem vende pelo AbacatePay: pagamento aprovado, nota emitida.</h2>
              <div className="ac-flow">
                {[['venda', 'Pagamento aprovado no AbacatePay'], ['webhook', 'Chega pro açaínfe na hora'], ['mágica fiscal', 'NFS-e emitida'], ['pronto', 'Cliente recebe por e-mail e WhatsApp']].map(([s, t]) => <div key={t}><small>{s}</small>{t}</div>)}
              </div>
            </Reveal>
          </div>
        </section>

        <section className="ac-section" id="faq">
          <div className="ac-container"><Reveal><h2 className="ac-h2">Perguntas frequentes</h2></Reveal><Faq items={faq} /></div>
        </section>

        <section className="ac-section ac-final">
          <span className="ac-dot" style={{ width: 90, height: 90, left: '8%', top: '14%' }} aria-hidden="true" />
          <span className="ac-dot" style={{ width: 54, height: 54, right: '10%', bottom: '18%', animationDelay: '-3s' }} aria-hidden="true" />
          <div className="ac-container" style={{ position: 'relative' }}>
            <Reveal>
              <h2>Você chegou até aqui. <span className="ac-hl">Não vendeu, não pagou. Vendeu, a nota já foi.</span></h2>
              <div style={{ display: 'grid', justifyItems: 'center' }}><Cta /></div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="ac-footer">
        <div className="ac-container">
          <div className="ac-footer__row">
            <div><Logo light /><p style={{ marginTop: 10 }}>açaínfe — emissão de NFS-e sem mensalidade.</p><p>CNPJ: [CNPJ]</p></div>
            <div style={{ display: 'grid', gap: 6, alignContent: 'start', justifyItems: 'start' }}>
              <button className="lk" onClick={() => setLegal('termos')}>Termos de uso</button>
              <button className="lk" onClick={() => setLegal('privacidade')}>Política de privacidade</button>
              <button className="lk" onClick={() => setLegal('contato')}>Contato</button>
            </div>
          </div>
          <p style={{ marginTop: 28, fontSize: '.8rem', opacity: .75 }}>O açaínfe não é afiliado ao AbacatePay.</p>
        </div>
      </footer>
      <LegalModal kind={legal} onClose={() => setLegal(null)} />
    </div>
  );
}
