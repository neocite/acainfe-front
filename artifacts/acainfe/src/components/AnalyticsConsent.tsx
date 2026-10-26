import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { getAnalytics, type AnalyticsConsent as Consent } from '../lib/analytics';
import '../analytics-consent.css';

const EVENT = 'acainfe:analytics-consent';

export function AnalyticsConsent() {
  const [mounted, setMounted] = useState(false);
  const [location] = useLocation();
  const en = location === '/en' || location.startsWith('/en/');
  const [state, setState] = useState<Consent>(() => getAnalytics()?.consent() ?? 'unknown');
  const [open, setOpen] = useState(false);
  const reopenRef = useRef<HTMLButtonElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    setMounted(true);
    const sync = () => setState(getAnalytics()?.consent() ?? 'unknown');
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);

  const visible = state === 'unknown' || open;

  useEffect(() => {
    if (open) acceptRef.current?.focus();
    else if (wasOpen.current) reopenRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const choose = useCallback((value: 'granted' | 'denied') => {
    getAnalytics()?.setConsent(value);
    setState(getAnalytics()?.consent() ?? value);
    setOpen(false);
  }, []);

  if (!mounted) return null;

  const t = en ? {
    title: 'Analytics cookies',
    body: 'Optional Google Analytics measures navigation, onboarding and checkout. No advertising, and no personal form data is sent.',
    accept: 'Accept', refuse: 'Decline', cookies: 'Cookies', close: 'Close',
    current: state === 'granted' ? 'Currently: accepted.' : state === 'denied' ? 'Currently: declined.' : '',
    more: 'Privacy', href: '/privacy',
  } : {
    title: 'Cookies de análise',
    body: 'O Google Analytics é opcional e mede navegação, cadastro e pagamento. Sem publicidade e sem dados pessoais de formulários.',
    accept: 'Aceitar', refuse: 'Recusar', cookies: 'Cookies', close: 'Fechar',
    current: state === 'granted' ? 'Atualmente: aceito.' : state === 'denied' ? 'Atualmente: recusado.' : '',
    more: 'Privacidade', href: '/privacidade',
  };

  return (
    <>
      {visible ? (
        <section
          className="acx-banner"
          role="region"
          aria-labelledby="acx-title"
          aria-describedby="acx-body"
          onKeyDown={e => { if (e.key === 'Escape' && state !== 'unknown') setOpen(false); }}
        >
          <h2 id="acx-title" className="acx-title">{t.title}</h2>
          <p id="acx-body" className="acx-body">
            {t.body} <a href={t.href}>{t.more}</a>. {t.current}
          </p>
          <div className="acx-actions">
            <button ref={acceptRef} type="button" className="acx-btn" onClick={() => choose('granted')}>{t.accept}</button>
            <button type="button" className="acx-btn" onClick={() => choose('denied')}>{t.refuse}</button>
            {state !== 'unknown' ? (
              <button type="button" className="acx-close" onClick={() => setOpen(false)}>{t.close}</button>
            ) : null}
          </div>
        </section>
      ) : (
        <button ref={reopenRef} type="button" className="acx-reopen" aria-haspopup="true" onClick={() => setOpen(true)}>
          {t.cookies}
        </button>
      )}
    </>
  );
}

export default AnalyticsConsent;
