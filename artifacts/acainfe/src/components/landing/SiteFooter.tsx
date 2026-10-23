import { Link } from 'wouter';
import { SUPPORT_EMAIL } from './Legal';
import { landingLanguage, type LandingLocale } from '@/lib/landing-language';

export function SiteFooter({ onTerms, home = false, locale = 'pt' }: { onTerms: () => void; home?: boolean; locale?: LandingLocale }) {
  const { t } = landingLanguage(locale);
  return <footer className="csr-footer">
    <a href={home ? '#inicio' : '/'} className="csr-logo" aria-label={t('açaínfe, início', 'açaínfe, home')}>aça<span>í</span>nfe<i /></a>
    <span>{t('Emissão de NFS-e que acompanha suas vendas.', 'Brazilian service invoices that follow your sales.')}</span><a href={home ? '#duvidas' : '/#duvidas'}>{t('Ajuda e dúvidas ↑', 'Help and FAQ ↑')}</a>
    <div className="csr-company">
      <span>{t('O açaínfe é uma marca da Extractify.', 'açaínfe is an Extractify brand.')}</span>
      <span>CNPJ: 28.095.894/0001-60</span>
      <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
    </div>
    <div className="csr-footer-legal">
      <Link href="/sobre">{t('Sobre', 'About (Portuguese)')}</Link>
      <Link href="/developers">{t('API e MCP', 'API & MCP (Portuguese)')}</Link>
      <button type="button" onClick={onTerms}>{t('Termos de uso', 'Terms of use')}</button>
      <Link href="/privacidade">{t('Política de privacidade', 'Privacy policy (Portuguese)')}</Link>
      <Link href="/contato">{t('Contato', 'Contact (Portuguese)')}</Link>
      <Link href={locale === 'en' ? '/' : '/en'} hrefLang={locale === 'en' ? 'pt-BR' : 'en'}>{locale === 'en' ? 'Português' : 'English'}</Link>
    </div>
    <small>{t('O açaínfe não é afiliado ao AbacatePay.', 'açaínfe is not affiliated with AbacatePay.')}</small>
  </footer>;
}
