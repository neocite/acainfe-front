import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { usePricing } from '@/components/landing/use-pricing';
import { useCoverage } from '@/components/landing/use-coverage';
import { StudioCalculator } from '@/components/landing/StudioCalculator';
import { Calculator } from '@/components/landing/Calculator';
import { LegalModal } from '@/components/landing/Legal';
import { SiteFooter } from '@/components/landing/SiteFooter';
import { setPublicCanonical } from '@/lib/public-metadata';
import { structuredData } from '@/lib/public-site-schema';
import { EN_HOME_TITLE, EN_IMAGE_ALT, EN_STEPS, englishDescription, englishFaq, englishRegimes, landingLanguage } from '@/lib/landing-language';
import './landing-studio.css';

export default function EnglishLanding() {
  const pricing = usePricing(), coverage = useCoverage();
  const price = pricing.pricePerInvoiceCents, fee = pricing.monthlyFeeCents;
  const { money } = landingLanguage('en');
  const [invoices, setInvoices] = useState(48);
  const [terms, setTerms] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const comparison = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    setPublicCanonical('/en'); document.documentElement.lang = 'en'; document.title = EN_HOME_TITLE;
    const description = englishDescription(pricing, coverage);
    const tags = [
      ['name', 'description', description], ['property', 'og:title', EN_HOME_TITLE],
      ['property', 'og:description', description], ['property', 'og:locale', 'en_US'],
      ['property', 'og:type', 'website'], ['property', 'og:image', `${window.location.origin}/api/og-en.png?v=2`],
      ['property', 'og:image:alt', EN_IMAGE_ALT], ['property', 'og:image:width', '1200'], ['property', 'og:image:height', '630'],
      ['name', 'twitter:title', EN_HOME_TITLE], ['name', 'twitter:description', description],
      ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:image', `${window.location.origin}/api/og-en.png?v=2`],
      ['name', 'twitter:image:alt', EN_IMAGE_ALT],
    ];
    for (const [attr, key, value] of tags) {
      let element = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!element) { element = document.createElement('meta'); element.setAttribute(attr, key); document.head.appendChild(element); }
      element.content = value;
    }
    const schema = document.querySelector<HTMLScriptElement>('script[type="application/ld+json"]');
    if (schema) schema.textContent = JSON.stringify(structuredData({ pricing, coverage }, 'en'));
  }, [price, fee, coverage]);
  return <div className="csr-page" id="inicio">
    <header className="csr-nav">
      <a href="#inicio" className="csr-logo" aria-label="açaínfe, home">aça<span>í</span>nfe<i /></a>
      <nav aria-label="Main navigation">
        <a href="#simulador">Calculator</a><a href="#como-funciona">How it works</a>
        <a href="#disponibilidade">Coverage</a><a href="#duvidas">FAQ</a><Link href="/developers">API &amp; MCP</Link>
      </nav>
      <Link className="csr-nav-link" href="/sign-in">Sign in <span aria-hidden="true">↗</span></Link>
    </header>
    <main>
      <section className="csr-hero">
        <div className="csr-hero-copy">
          <div className="csr-eyebrow"><span className="csr-status-dot" /> INVOICES ON AUTOPILOT</div>
          <p className="csr-kicker">For digital businesses</p>
          <h1><span className="sr-only">açaínfe: automatic Brazilian service invoices (NFS-e). </span>Sold.<br /><em>Invoice sent.</em></h1>
          <p className="csr-lead">Each approved payment on AbacatePay becomes an NFS-e — no end-of-month spreadsheets, {fee === 0 ? 'no monthly fee when sales are quiet.' : 'with transparent pricing.'}</p>
          <div className="csr-hero-actions">
            <Link className="csr-button" href="/sign-up">Get started <span aria-hidden="true">↗</span></Link>
            <a className="csr-text-link" href="#como-funciona">See how it works <span aria-hidden="true">↓</span></a>
          </div>
          <div className="csr-proofline"><span className="csr-check" aria-hidden="true">✓</span><span><strong>{money(price)}</strong> per successfully issued invoice</span><span className="csr-proof-divider" /><span>{fee === 0 ? 'No fixed fee' : `${money(fee)} per month`}</span></div>
        </div>
        <StudioCalculator locale="en" price={price} monthlyFee={fee} invoices={invoices} onInvoicesChange={setInvoices} onCompare={() => { setCompareOpen(true); comparison.current?.showModal(); }} />
        <div className="csr-hero-foot"><span>SIMPLE PRICING. NO SURPRISES.</span><a href="#simulador">Drag to estimate <b aria-hidden="true">↘</b></a></div>
      </section>
      <section className="csr-equation" aria-label="Pricing model">
        <h2 className="sr-only">Pricing</h2><span>Your volume changes.</span>
        <strong>{money(fee)} fixed <i>+</i> {money(price)} per invoice</strong><span>Your costs follow your sales.</span>
      </section>
      <section className="csr-process" id="como-funciona">
        <div className="csr-section-head"><div><span className="csr-label">FROM PAYMENT TO INVOICE</span><h2>You make the sale.<br /><em>We complete the process.</em></h2></div><p>Set it up once. Then every approved payment follows the process automatically.</p></div>
        <div className="csr-steps">{EN_STEPS.map(step => <article key={step.number}><div className="csr-step-top"><span>{step.number}</span><i aria-hidden="true">↗</i></div><h3>{step.title}</h3><p>{step.copy}</p></article>)}</div>
      </section>
      <section className="csr-zero" id="so-paga-se-vender">
        <span className="csr-zero-mark" aria-hidden="true">“</span>
        <div><span className="csr-label">AND WHEN THERE ARE NO SALES?</span><h2>Your costs<br /><em>pause too.</em></h2></div>
        <div className="csr-zero-note"><strong>{money(fee)}</strong><p>No sales, no invoices.<br /><b>{fee === 0 ? 'No invoices, no charges.' : 'Only the monthly fee, no invoice charges.'}</b></p></div>
      </section>
      <section className="csr-availability" id="disponibilidade">
        <span id="compatibilidade" />
        <div className="csr-availability-copy"><span className="csr-label">AVAILABLE TODAY</span><h2>City by city.<br /><em>Care in every invoice.</em></h2><p>Currently available for MEI and Simples Nacional businesses in the Brazilian cities below. We are expanding municipal coverage. In other cities, sign up for the waiting list.</p></div>
        <div className="csr-city-list">{coverage.cities.map(city => <div className="csr-city-card" key={city.cityCode}><span className="csr-pin" aria-hidden="true">◎</span><div><strong>{city.cityName}</strong><span>{city.uf} · {englishRegimes(city.regimes)}</span></div><span className="csr-active">ACTIVE</span></div>)}</div>
        <Link href="/sign-up" className="csr-availability-link">Check coverage for my business <span aria-hidden="true">↗</span></Link>
        <p className="csr-independent">Independent product, not affiliated with AbacatePay.</p>
      </section>
      <section className="sr-only" aria-label="AI agents and MCP"><h2>AI agents and MCP</h2><p>açaínfe can be operated by AI agents via MCP (Model Context Protocol). Set up your company and connect your assistant to work with your service invoices.</p><a href="/llms.txt">Information for AI agents</a></section>
      <section className="csr-faq" id="duvidas">
        <span id="faq" className="csr-anchor" /><div className="csr-faq-intro"><span className="csr-label">BEFORE YOU START</span><h2>No fine print.<br /><em>Just answers.</em></h2><p>The essentials, explained clearly.</p></div>
        <div className="csr-faq-list">{englishFaq(price, coverage).map(({ q, a }) => <details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div>
      </section>
      <section className="csr-close" id="comece">
        <span className="csr-label">PAY FOR WHAT HAPPENS</span><h2>Your next payment<br />could already become an <em>invoice.</em></h2><p>Set it up once. Then let each approved sale do the rest.</p>
        <Link className="csr-button csr-button-light" href="/sign-up">Get started <span aria-hidden="true">↗</span></Link><small>{fee === 0 ? 'No monthly fee. ' : ''}No setup fee.</small>
      </section>
    </main>
    <SiteFooter locale="en" home onTerms={() => setTerms(true)} />
    <dialog ref={comparison} className="csr-comparison-dialog" aria-label="Plan and source comparison" onClose={() => { if (!comparison.current?.open) setCompareOpen(false); }} onClick={e => {
      if (e.target !== comparison.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) comparison.current?.close();
    }}>
      <div className="csr-comparison-close"><button type="button" onClick={() => comparison.current?.close()}>Close comparison ×</button></div>
      <div id="comparador">{compareOpen && <Calculator locale="en" price={price} initialNotes={invoices} />}</div>
    </dialog>
    <LegalModal locale="en" kind={terms ? 'termos' : null} onClose={() => setTerms(false)} />
  </div>;
}
