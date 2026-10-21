import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { institutionalPage } from '../lib/institutional-content';
import { SiteFooter } from '../components/landing/SiteFooter';
import { LegalModal } from '../components/landing/Legal';
import './landing-studio.css';
import './institutional.css';

function contactLinks(text: string) {
  return text.split(/(contato@extractify\.com\.br|\(11\) 3458-7367)/g).map((part, index) =>
    part === 'contato@extractify.com.br' ? <a key={index} href={`mailto:${part}`}>{part}</a>
      : part === '(11) 3458-7367' ? <a key={index} href="tel:+551134587367">{part}</a> : part);
}

export default function Institutional({ path }: { path: string }) {
  const page = institutionalPage(path)!;
  const [terms, setTerms] = useState(false);
  useEffect(() => {
    document.title = `${page.title} — açaínfe`;
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
      document.head.querySelector(selector)?.setAttribute('content', page.description);
    }
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
      document.head.querySelector(selector)?.setAttribute('content', `${page.title} — açaínfe`);
    }
    // The application router keeps the document head between client-side routes.
    document.head.querySelector('script[type="application/ld+json"]')?.remove();
  }, [page]);
  return <div className="csr-page">
    <header className="csr-nav">
      <Link href="/" className="csr-logo" aria-label="açaínfe, início">aça<span>í</span>nfe<i /></Link>
      <nav aria-label="Navegação principal">
        <Link href="/">Início</Link><Link href="/sobre">Sobre</Link><Link href="/contato">Contato</Link><Link href="/privacidade">Privacidade</Link>
      </nav>
      <Link className="csr-nav-link" href="/sign-in">Entrar <span aria-hidden="true">↗</span></Link>
    </header>
    <main className="institutional-main">
      <Link className="institutional-back" href="/">← Voltar ao início</Link>
      <h1>{page.title}</h1>
      {page.version && <div className="institutional-version"><p>{page.version}</p><small>{page.notice}</small></div>}
      {page.sections.map(section => <section key={section.title}>
        <h2>{section.title}</h2>
        {section.paragraphs.map(text => <p key={text}>{contactLinks(text)}</p>)}
      </section>)}
    </main>
    <SiteFooter onTerms={() => setTerms(true)} />
    <LegalModal kind={terms ? 'termos' : null} onClose={() => setTerms(false)} />
  </div>;
}
