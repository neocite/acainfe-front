import { Link } from 'wouter';
import { SUPPORT_EMAIL } from './Legal';

export function SiteFooter({ onTerms, home = false }: { onTerms: () => void; home?: boolean }) {
  return <footer className="csr-footer">
    <a href={home ? '#inicio' : '/'} className="csr-logo" aria-label="açaínfe, início">aça<span>í</span>nfe<i /></a>
    <span>Emissão de NFS-e que acompanha suas vendas.</span><a href={home ? '#duvidas' : '/#duvidas'}>Ajuda e dúvidas ↑</a>
    <div className="csr-company">
      <span>O açaínfe é uma marca da Extractify.</span>
      <span>CNPJ: 28.095.894/0001-60</span>
      <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
    </div>
    <div className="csr-footer-legal">
      <Link href="/sobre">Sobre</Link>
      <Link href="/developers">API e MCP</Link>
      <button type="button" onClick={onTerms}>Termos de uso</button>
      <Link href="/privacidade">Política de privacidade</Link>
      <Link href="/contato">Contato</Link>
    </div>
    <small>O açaínfe não é afiliado ao AbacatePay nem à Hotmart.</small>
  </footer>;
}
