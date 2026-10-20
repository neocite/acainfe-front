import { useEffect } from 'react';
import { Link } from 'wouter';

export type LegalKind = 'termos' | 'privacidade' | 'contato';
export const SUPPORT_EMAIL = 'contato@extractify.com.br';
const TITLES: Record<LegalKind, string> = { termos: 'Termos de uso', privacidade: 'Política de privacidade', contato: 'Contato' };

export function LegalModal({ kind, onClose }: { kind: LegalKind | null; onClose: () => void }) {
  useEffect(() => {
    if (!kind) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [kind, onClose]);
  if (!kind) return null;
  return (
    <div className="ac-modal" onClick={onClose}>
      <div className="ac-modal__box" role="dialog" aria-modal="true" aria-label={TITLES[kind]} onClick={(e) => e.stopPropagation()}>
        <h3>{TITLES[kind]}</h3>
        <p>
          {kind === 'contato'
            ? <>Fale com a gente pelo e-mail <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</>
            : 'Este documento ainda aguarda o preenchimento pela empresa operadora do açaínfe. Nenhum termo com valor jurídico foi publicado nesta página até agora.'}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="ac-btn ac-btn--acai ac-btn--sm" onClick={onClose}>Fechar</button>
          <Link href="/app" className="ac-btn ac-btn--ghost ac-btn--sm">Ir para o app</Link>
        </div>
      </div>
    </div>
  );
}
