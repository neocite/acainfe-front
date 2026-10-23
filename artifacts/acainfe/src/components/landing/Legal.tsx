import { useEffect } from 'react';
import { Link } from 'wouter';
import { landingLanguage, type LandingLocale } from '@/lib/landing-language';

export type LegalKind = 'termos' | 'privacidade' | 'contato';
export const SUPPORT_EMAIL = 'contato@extractify.com.br';
const TITLES: Record<LegalKind, string> = { termos: 'Termos de uso', privacidade: 'Política de privacidade', contato: 'Contato' };

export function LegalModal({ kind, onClose, locale = 'pt' }: { kind: LegalKind | null; onClose: () => void; locale?: LandingLocale }) {
  const { t } = landingLanguage(locale);
  const title = kind ? (locale === 'en' ? { termos: 'Terms of use', privacidade: 'Privacy policy', contato: 'Contact' }[kind] : TITLES[kind]) : '';
  useEffect(() => {
    if (!kind) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [kind, onClose]);
  if (!kind) return null;
  return (
    <div className="ac-modal" onClick={onClose}>
      <div className="ac-modal__box" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>
          {kind === 'contato'
            ? <>{t('Fale com a gente pelo e-mail', 'Contact us by email at')} <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</>
            : t('Este documento ainda aguarda o preenchimento pela empresa operadora do açaínfe. Nenhum termo com valor jurídico foi publicado nesta página até agora.', 'This document is awaiting completion by the company operating açaínfe. No legally binding terms have been published on this page yet.')}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="ac-btn ac-btn--acai ac-btn--sm" onClick={onClose}>{t('Fechar', 'Close')}</button>
          <Link href="/app" className="ac-btn ac-btn--ghost ac-btn--sm">{t('Ir para o app', 'Open the app')}</Link>
        </div>
      </div>
    </div>
  );
}
