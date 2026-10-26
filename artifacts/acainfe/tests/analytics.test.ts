import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { ANALYTICS_CONSENT_KEY, GA_MEASUREMENT_ID, analyticsPagePath, createAnalytics } from '../src/lib/analytics';

function fixture(url = 'https://acainfe.com/app?email=private@example.test#secret') {
  const dom = new JSDOM('<!doctype html><head></head><body></body>', { url });
  const win = dom.window as unknown as Window & { dataLayer?: ArrayLike<unknown>[]; gtag?: (...args: unknown[]) => void };
  Object.defineProperty(win, 'crypto', { value: webcrypto });
  const tracker = createAnalytics(win);
  const calls = () => (win.dataLayer ?? []).map(args => Array.from(args));
  const events = () => calls().filter(args => args[0] === 'event');
  return { dom, win, tracker, calls, events };
}

describe('Google Analytics: consentimento, privacidade e eventos', () => {
  it('purchase usa o pagamento confirmado e valor efetivamente pago, com deduplicação por ID entre instâncias', () => {
    const f = fixture();
    try {
      f.tracker.setConsent('granted');
      const payment = { paymentId: 'pix-123', status: 'PAID', currency: 'BRL', paidAmountCents: 13000 };
      assert.equal(f.tracker.pixPaid(payment), true);
      assert.equal(f.tracker.pixPaid(payment), false);
      const reloaded = createAnalytics(f.win); reloaded.init();
      assert.equal(reloaded.pixPaid(payment), false);
      const purchases = f.events().filter(e => e[1] === 'purchase');
      assert.equal(purchases.length, 1);
      assert.equal((purchases[0][2] as any).transaction_id, 'pix-123');
      assert.equal((purchases[0][2] as any).value, 130);
      assert.equal((purchases[0][2] as any).items[0].price, 130);
      assert.equal((purchases[0][2] as any).payment_type, 'pix');
      assert.equal((purchases[0][2] as any).checkout_type, 'billing_balance');
    } finally { f.dom.window.close(); }
  });
  it('não deduplica como enviado antes de consentir, nem emite para pendente, expirado ou valores inválidos', () => {
    const f = fixture();
    try {
      const payment = { paymentId: 'pix-123', status: 'PAID', currency: 'BRL', paidAmountCents: 100 };
      assert.equal(f.tracker.pixPaid(payment), false);
      assert.equal(f.win.sessionStorage.length, 0);
      f.tracker.setConsent('granted');
      for (const status of ['PENDING', 'EXPIRED']) assert.equal(f.tracker.pixPaid({ ...payment, status }), false);
      for (const paidAmountCents of [undefined, null, NaN, Infinity, 0, -1, 1.5]) assert.equal(f.tracker.pixPaid({ ...payment, paidAmountCents }), false);
      assert.equal(f.tracker.pixPaid({ ...payment, currency: 'USD' }), false);
      assert.equal(f.tracker.pixPaid({ ...payment, paymentId: '' }), false);
      assert.equal(f.tracker.pixPaid(payment), true);
      f.tracker.setConsent('denied');
      assert.equal(f.tracker.pixPaid({ ...payment, paymentId: 'second' }), false);
    } finally { f.dom.window.close(); }
  });
  it('deduplica em memória quando sessionStorage está bloqueado, e não marca evento que falhou na fila', () => {
    const f = fixture();
    try {
      f.tracker.setConsent('granted');
      Object.defineProperty(f.win, 'sessionStorage', { get: () => { throw new Error('blocked'); } });
      const payment = { paymentId: 'pix-123', status: 'PAID', currency: 'BRL', paidAmountCents: 100 };
      const original = f.win.gtag;
      f.win.gtag = () => { throw new Error('blocked'); };
      assert.equal(f.tracker.pixPaid(payment), false);
      f.win.gtag = original;
      assert.equal(f.tracker.pixPaid(payment), true);
      assert.equal(f.tracker.pixPaid(payment), false);
    } finally { f.dom.window.close(); }
  });
  it('não carrega a tag nem rastreia antes da autorização ou depois de recusar', async () => {
    const f = fixture();
    try {
      f.tracker.init();
      f.tracker.onboarding('onboarding_start');
      await f.tracker.pixGenerated(80, 'private-pix');
      assert.equal(f.win.document.querySelectorAll('script').length, 0);
      assert.equal(f.events().length, 0);
      f.tracker.setConsent('denied');
      f.tracker.init();
      assert.equal(f.events().length, 0);
      assert.equal(f.tracker.consent(), 'denied');
    } finally { f.dom.window.close(); }
  });

  it('configura o ID fornecido uma vez, bloqueia anúncios e envia uma pageview por rota', () => {
    const f = fixture();
    try {
      f.tracker.setConsent('granted');
      f.tracker.init(); f.tracker.pageView();
      assert.equal(f.win.document.querySelectorAll('#acainfe-google-tag').length, 1);
      assert.equal(f.win.document.querySelector('script')?.getAttribute('src'), `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`);
      const config = f.calls().find(call => call[0] === 'config')!;
      assert.equal(config[1], GA_MEASUREMENT_ID);
      assert.equal((config[2] as any).send_page_view, false);
      assert.equal((config[2] as any).allow_google_signals, false);
      assert.equal((config[2] as any).allow_ad_personalization_signals, false);
      assert.equal(f.events().length, 1);
      assert.equal((f.events()[0][2] as any).page_location, 'https://acainfe.com/app');
      assert.doesNotMatch(JSON.stringify(f.calls()), /private@example|#secret|\?email/);
      f.win.history.pushState({}, '', '/en');
      f.tracker.pageView(); f.tracker.pageView();
      assert.equal(f.events().length, 2);
    } finally { f.dom.window.close(); }
  });

  it('não contamina a propriedade em prévias e ambientes de teste', () => {
    const f = fixture('https://example.replit.dev/app');
    try {
      f.tracker.setConsent('granted');
      assert.equal(f.win.document.querySelectorAll('script').length, 0);
      assert.equal(f.events().length, 0);
    } finally { f.dom.window.close(); }
  });

  it('registra as etapas com dimensões fixas, inclusive contador pulado, sem mensagens livres', () => {
    const f = fixture();
    try {
      f.tracker.setConsent('granted');
      f.tracker.onboarding('onboarding_start');
      for (const step of ['personal_details', 'certificate', 'company', 'accountant', 'abacatepay', 'assistant'] as const) {
        f.tracker.onboarding('onboarding_step_view', step);
        f.tracker.onboarding('onboarding_step_complete', step, { skipped: step === 'accountant' });
      }
      f.tracker.onboarding('onboarding_error', 'certificate', { httpStatus: 422 });
      f.tracker.onboarding('onboarding_complete');
      const skipped = f.events().find(e => e[1] === 'onboarding_step_complete' && (e[2] as any).step_name === 'accountant')!;
      assert.equal((skipped[2] as any).skipped, true);
      assert.equal(f.events().filter(e => e[1] === 'onboarding_step_view').length, 6);
      assert.doesNotMatch(JSON.stringify(f.events()), /email|password|apiKey|cnpj|taxId|certificatePassword/);
    } finally { f.dom.window.close(); }
  });

  it('emite checkout e Pix gerado só com valor em reais e deduplica o mesmo Pix entre recargas', async () => {
    const f = fixture();
    try {
      f.tracker.setConsent('granted');
      await Promise.all([f.tracker.pixGenerated(12345, 'sensitive-pix-code'), f.tracker.pixGenerated(12345, 'sensitive-pix-code')]);
      const second = createAnalytics(f.win);
      second.init();
      await second.pixGenerated(12345, 'sensitive-pix-code');
      assert.equal(f.events().filter(e => e[1] === 'begin_checkout').length, 1);
      assert.equal(f.events().filter(e => e[1] === 'pix_generated').length, 1);
      const payload = f.events().find(e => e[1] === 'pix_generated')![2] as any;
      assert.equal(payload.value, 123.45);
      assert.equal(payload.currency, 'BRL');
      assert.equal(payload.payment_type, 'pix');
      assert.equal(payload.items[0].price, 123.45);
      assert.doesNotMatch(JSON.stringify(f.calls()), /sensitive-pix-code/);
      assert.doesNotMatch(JSON.stringify(f.win.sessionStorage), /sensitive-pix-code/);
      assert.equal(f.events().some(e => e[1] === 'purchase'), false, 'Pix gerado não é pagamento confirmado');
    } finally { f.dom.window.close(); }
  });

  it('não conta Pix inválido, gratuito ou ausente como checkout', async () => {
    const f = fixture();
    try {
      f.tracker.setConsent('granted');
      for (const amount of [-1, 0, 1.5, NaN, Infinity]) await f.tracker.pixGenerated(amount, 'fixture');
      await f.tracker.pixGenerated(80, '');
      assert.equal(f.events().filter(e => e[1] === 'pix_generated').length, 0);
    } finally { f.dom.window.close(); }
  });

  it('revoga consentimento, remove cookies GA e interrompe eventos', () => {
    const f = fixture();
    try {
      f.tracker.setConsent('granted');
      f.win.document.cookie = '_ga=test; Path=/';
      const before = f.events().length;
      f.tracker.setConsent('denied');
      f.tracker.onboarding('onboarding_start');
      assert.equal(f.events().length, before);
      assert.equal(f.win.document.cookie.includes('_ga='), false);
      assert.equal(f.win.localStorage.getItem(ANALYTICS_CONSENT_KEY), 'denied');
      assert.equal((f.win as any)[`ga-disable-${GA_MEASUREMENT_ID}`], true);
    } finally { f.dom.window.close(); }
  });

  it('trata falhas do Google sem quebrar ações do usuário', () => {
    const f = fixture();
    try {
      f.win.gtag = () => { throw new Error('blocked'); };
      assert.doesNotThrow(() => f.tracker.setConsent('granted'));
      assert.doesNotThrow(() => f.tracker.onboarding('onboarding_start'));
    } finally { f.dom.window.close(); }
  });

  it('normaliza callbacks e caminhos arbitrários sem enviar tokens ou identificadores', () => {
    assert.equal(analyticsPagePath('/sign-in/sso-callback'), '/sign-in');
    assert.equal(analyticsPagePath('/sign-up/verify-email-address'), '/sign-up');
    assert.equal(analyticsPagePath('/unknown-private-id'), '/404');
    assert.equal(analyticsPagePath('/app'), '/app');
  });
});
