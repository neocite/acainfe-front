/** Public GA4 measurement ID. No account identifiers or free-form input go to GA. */
export const GA_MEASUREMENT_ID = 'G-C3EDFQBQWH';
export const ANALYTICS_CONSENT_KEY = 'acainfe.analytics-consent.v1';
export type AnalyticsConsent = 'granted' | 'denied' | 'unknown';
export type OnboardingStep = 'personal_details' | 'certificate' | 'company' | 'accountant' | 'abacatepay' | 'assistant';
type OnboardingEvent = 'onboarding_start' | 'onboarding_step_view' | 'onboarding_step_complete' | 'onboarding_complete' | 'onboarding_waitlisted' | 'onboarding_error' | 'onboarding_mcp_key_created';
type Gtag = (...args: unknown[]) => void;
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag };

/** Only known page paths: never send query strings, login callbacks or arbitrary URLs. */
export function analyticsPagePath(path: string): string {
  if (/^\/sign-in(?:\/|$)/.test(path)) return '/sign-in';
  if (/^\/sign-up(?:\/|$)/.test(path)) return '/sign-up';
  return ['/', '/en', '/app', '/app/conta', '/onboarding', '/sobre', '/contato', '/privacidade', '/developers', '/about', '/contact', '/privacy'].includes(path) ? path : '/404';
}

export function createAnalytics(win: AnalyticsWindow) {
  let active = false;
  let choice: AnalyticsConsent | undefined;
  let lastPage = '';
  const emitted = new Set<string>();
  const production = ['acainfe.com', 'www.acainfe.com'].includes(win.location.hostname);
  function consent(): AnalyticsConsent {
    try {
      const value = win.localStorage.getItem(ANALYTICS_CONSENT_KEY);
      return value === 'granted' || value === 'denied' ? value : choice ?? 'unknown';
    } catch { return choice ?? 'unknown'; }
  }
  function gtag(...args: unknown[]) {
    try {
      if (!win.gtag) return false;
      win.gtag(...args);
      return true;
    } catch { return false; /* Telemetry must never break a user action. */ }
  }
  function page() {
    const path = analyticsPagePath(win.location.pathname);
    return { page_location: `https://acainfe.com${path}`, page_path: path, page_title: 'açaínfe', page_referrer: '' };
  }
  function event(name: string, params: Record<string, unknown> = {}) {
    if (!active || !production || consent() !== 'granted') return false;
    return gtag('event', name, { ...page(), ...params, send_to: GA_MEASUREMENT_ID });
  }
  function pageView() {
    const path = page().page_path;
    if (!active || lastPage === path) return;
    if (event('page_view')) lastPage = path;
  }
  function init() {
    if (!production || consent() !== 'granted' || active) return;
    active = true;
    (win as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`] = false;
    win.dataLayer ??= [];
    win.gtag ??= function () { win.dataLayer!.push(arguments); };
    gtag('consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    });
    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID, {
      send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false, ...page(),
    });
    if (!win.document.getElementById('acainfe-google-tag')) {
      const script = win.document.createElement('script');
      script.id = 'acainfe-google-tag'; script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      win.document.head.appendChild(script);
    }
    pageView();
  }
  function setConsent(value: 'granted' | 'denied') {
    choice = value;
    try { win.localStorage.setItem(ANALYTICS_CONSENT_KEY, value); } catch { /* Keep the current choice in memory. */ }
    if (value === 'granted') {
      // Even if storage is unavailable, an explicit choice can enable this page.
      if (consent() === 'granted') init();
    } else {
      gtag('consent', 'update', { analytics_storage: 'denied' });
      active = false; lastPage = '';
      (win as unknown as Record<string, unknown>)[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
      for (const cookie of win.document.cookie.split(';')) {
        const name = cookie.split('=')[0].trim();
        if (!/^_ga(?:_|$)/.test(name)) continue;
        for (const domain of ['', '; Domain=acainfe.com', '; Domain=.acainfe.com', '; Domain=www.acainfe.com']) {
          win.document.cookie = `${name}=; Max-Age=0; Path=/${domain}; SameSite=Lax`;
        }
      }
    }
    const change = win.document.createEvent('Event');
    change.initEvent('acainfe:analytics-consent', false, false);
    win.dispatchEvent(change);
  }
  function onboarding(name: OnboardingEvent, step?: OnboardingStep, details?: { skipped?: boolean; httpStatus?: number }) {
    return event(name, {
      ...(step ? { step_name: step, step_number: { personal_details: 1, certificate: 2, company: 3, accountant: 3, abacatepay: 4, assistant: 5 }[step] } : {}),
      ...(typeof details?.skipped === 'boolean' ? { skipped: details.skipped } : {}),
      ...(Number.isInteger(details?.httpStatus) ? { http_status: details!.httpStatus } : {}),
    });
  }
  async function pixGenerated(amountCents: number, pixPayload: string) {
    if (!active || !Number.isSafeInteger(amountCents) || amountCents <= 0 || !pixPayload) return;
    // The Pix code never leaves the browser. A digest deduplicates repeated API responses.
    let id: string;
    try {
      const digest = await win.crypto.subtle.digest('SHA-256', new TextEncoder().encode(pixPayload));
      id = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    } catch { return; }
    const key = `acainfe.ga.pix.${id}`;
    if (emitted.has(key)) return;
    try { if (win.sessionStorage.getItem(key)) return; } catch { /* In-memory dedupe remains available. */ }
    const params = {
      currency: 'BRL', value: amountCents / 100, payment_type: 'pix', checkout_type: 'billing_balance',
      items: [{ item_id: 'acainfe_invoice_fees', item_name: 'Emissão de NFS-e', price: amountCents / 100, quantity: 1 }],
    };
    if (!event('begin_checkout', params)) return;
    event('pix_generated', params);
    emitted.add(key);
    try { win.sessionStorage.setItem(key, '1'); } catch { /* No sensitive checkout data is persisted. */ }
  }
  function pixPaid(payment: { paymentId: string; status: string; currency: string; paidAmountCents?: number | null }) {
    if (payment.status !== 'PAID' || payment.currency !== 'BRL' ||
        typeof payment.paymentId !== 'string' || !payment.paymentId ||
        !Number.isSafeInteger(payment.paidAmountCents) || payment.paidAmountCents! <= 0) return false;
    const key = `acainfe.ga.purchase.${encodeURIComponent(payment.paymentId)}`;
    if (emitted.has(key)) return false;
    try { if (win.sessionStorage.getItem(key)) return false; } catch { /* In-memory fallback. */ }
    const value = payment.paidAmountCents! / 100;
    if (!event('purchase', {
      transaction_id: payment.paymentId, currency: 'BRL', value, payment_type: 'pix', checkout_type: 'billing_balance',
      items: [{ item_id: 'acainfe_invoice_fees', item_name: 'Emissão de NFS-e', price: value, quantity: 1 }],
    })) return false;
    emitted.add(key);
    try { win.sessionStorage.setItem(key, '1'); } catch { /* In-memory fallback, GA also receives the stable ID. */ }
    return true;
  }
  return { consent, init, setConsent, pageView, onboarding, pixGenerated, pixPaid };
}

let browser: Window | undefined;
let instance: ReturnType<typeof createAnalytics> | undefined;
export function getAnalytics() {
  if (typeof window === 'undefined') return undefined;
  if (browser !== window) { browser = window; instance = createAnalytics(window); }
  return instance;
}
export const trackOnboarding = (event: OnboardingEvent, step?: OnboardingStep, details?: { skipped?: boolean; httpStatus?: number }) => {
  return getAnalytics()?.onboarding(event, step, details) ?? false;
};
export const trackPixGenerated = (amountCents: number, payload: string) => {
  void getAnalytics()?.pixGenerated(amountCents, payload);
};
export const trackPixPaid = (payment: { paymentId: string; status: string; currency: string; paidAmountCents?: number | null }) => {
  return getAnalytics()?.pixPaid(payment) ?? false;
};
