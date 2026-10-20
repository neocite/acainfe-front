import * as React from 'react';
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowRight, ArrowLeft, Check, ShieldCheck, FileKey, Sparkles, Copy, CheckCheck, LogOut, Loader2, Wallet, Building2, AlertTriangle, Leaf, Mail } from 'lucide-react';
import { api, ApiError, phoneMask } from '../lib/api';
import { isOptionalCompanyField, onboardingCompanyPatch, simplesRateInput, municipalRegistrationHelp, type ReadinessItem, type OptionalCompanyField } from '../lib/company-details';
import { CompanyRecommendationDialog } from '../components/CompanyRecommendationDialog';
import { AbacatePayStep } from '../components/AbacatePayStep';
import { AbacatePayWebhookCard } from '../components/AbacatePayWebhookCard';
import { FiscalCompanyFields } from '../components/FiscalCompanyFields';
import { McpKeysSection } from '../components/McpKeysSection';
import { CompanyCard, TestEnvironmentNotice } from '../components/CompanyCard';
import { ApproximateTaxesFields } from '../components/ApproximateTaxesFields';
import { FiscalSettings } from '../components/FiscalSettings';
import { approximateTaxInputs, approximateTaxPatch, isTestEnvironment, type ApproximateTaxes, type Emission } from '../lib/fiscal-settings';
import { mergeCompanyProfile, companyStatusLabel, certificateExpiryLabel, type CompanyProfile } from '../lib/company-profile';
import { fiscalCompanyPatch } from '../lib/fiscal-profiles';
import { bpsToPercent } from '../lib/numbers';
import { hermesMcpCommand } from '../lib/hermes-mcp';
import { createMcpKey, type GeneratedMcpKey } from '../lib/mcp-keys';
import { isAuthUser, type AuthUser } from '../lib/auth';
import { onboardingEntry } from '../lib/onboarding-entry';
import { brl } from '../config/pricing';
import '../onboarding.css';
import '../mobile-fixes.css';
import '../company-details.css';
import '../abacatepay-step.css';
import '../abacatepay-webhook.css';
import '../past-sales.css';
import '../products.css';
import '../fiscal-company.css';
import '../mcp-keys.css';

type User = AuthUser;
type CompanyStatus = CompanyProfile & {
  tenant: { id: string; cnpj?: string; taxRegime?: string; municipalRegistration?: string | null; simplesNacionalTaxRateBps?: number | null; status?: string; integrations?: { abacatepay?: boolean }; certificateExpiresAt?: string; accountant?: unknown; businessType?: string | null; issRateBps?: number | null; environment?: string; approximateTaxes?: ApproximateTaxes | null };
  abacatepay?: { connected: boolean; connectedAt?: string | null; webhookEndpoint?: string | null; webhookUpToDate?: boolean | null };
  emission?: Emission;
  approximateTaxes?: ApproximateTaxes | null;
  company?: { legalName?: string; tradeName?: string; cityName?: string; uf?: string };
  availability: { status: string; reason?: string };
  readiness: { canIssue: boolean; missing: ReadinessItem[]; recommended?: ReadinessItem[] };
  pendingTaxReview: number | unknown[];
  certificate?: { expiresAt?: string; validUntil?: string };
};
type Billing = { status: string; openCents: number; openCharges: number; creditCents: number; amountDueCents: number; blocksAt?: string; overdue: boolean; pricePerInvoiceCents: number };
type Pix = { amountCents: number; pixCopyPaste: string; pixQrCodeImage: string; expiresAt: string };
const steps = ['Seus dados', 'Certificado', 'Sua empresa', 'AbacatePay', 'Seu assistente'];
const ValidationContext = createContext<Record<string, string>>({});
const fieldNames: Record<string, string> = {
  'Seu nome': 'name', 'WhatsApp com DDD': 'whatsapp',
  'Arquivo do certificado': 'file', 'Senha do certificado': 'password',
  'Inscrição municipal (CCM)': 'municipalRegistration',
  'Alíquota efetiva do Simples (%)': 'simplesNacionalTaxRateBps',
  'Regime da empresa': 'taxRegime', 'Sua API key do AbacatePay': 'apiKey',
};
function Brand() { return <Link href="/" className="app-brand">açaínfe<span className="brand-dot" /></Link>; }
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const resetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (resetTimer.current !== null) clearTimeout(resetTimer.current); }, []);
  return <button className="copy-button" type="button" onClick={async () => {
    try {
      await navigator.clipboard.writeText(text); setCopied(true); setError(false);
      if (resetTimer.current !== null) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 2000);
    }
    catch { setError(true); }
  }}>{copied ? <CheckCheck size={16} /> : <Copy size={16} />}{error ? 'Selecione e copie' : copied ? 'Copiado!' : 'Copiar'}</button>;
}
function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  const errors = useContext(ValidationContext);
  const error = errors[fieldNames[label] || label];
  return <label className="app-field"><span>{label}</span>{children}{help && <small>{help}</small>}{error && <small className="danger-text" role="alert">{error}</small>}</label>;
}
export default function Onboarding() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [editingRecommendation, setEditingRecommendation] = useState<(ReadinessItem & { field: OptionalCompanyField }) | null>(null);
  const [status, setStatus] = useState<CompanyStatus | null>(null);
  const [step, setStep] = useState(1);
  const [view, setView] = useState<'wizard' | 'panel' | 'billing' | 'fiscal'>('wizard');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [municipal, setMunicipal] = useState('');
  const [rate, setRate] = useState('');
  const [approximateRate, setApproximateRate] = useState('15,53');
  const [approximateTemplate, setApproximateTemplate] = useState(approximateTaxInputs().template);
  const [regime, setRegime] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [issRate, setIssRate] = useState('');
  const [numbering, setNumbering] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [series, setSeries] = useState('');
  const [nextNumber, setNextNumber] = useState('');
  const [accountant, setAccountant] = useState({ name: '', email: '', whatsapp: '' });
  const [accountantSkipped, setAccountantSkipped] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [mcp, setMcp] = useState<GeneratedMcpKey | null>(null);
  const [mcpLabel, setMcpLabel] = useState('');
  const [mcpRevision, setMcpRevision] = useState(0);
  const [client, setClient] = useState('code');
  const [billing, setBilling] = useState<Billing | null>(null);
  const [pix, setPix] = useState<Pix | null>(null);
  const id = status?.tenant.id;
  const base = `/app/companies/${encodeURIComponent(id || '')}`;

  useEffect(() => { setMcp(null); setMcpLabel(''); }, [id]);
  useEffect(() => { if (view !== 'wizard' || step !== 5) setMcp(null); }, [view, step]);
  function prepareMcpKey() {
    setMcp(null); setMcpLabel(''); setStep(5); setView('wizard');
  }
  function handleMcpRevoked(ids?: string[]) {
    setMcp(current => current && (!ids || !current.key || ids.includes(current.key.id)) ? null : current);
  }
  async function generateMcpKey() {
    await run(async () => {
      const generated = await createMcpKey(base, mcpLabel);
      setMcp(generated);
      setMcpLabel('');
      setMcpRevision(revision => revision + 1);
    });
  }
  function applyStatus(s: CompanyStatus) {
    setStatus(previous => mergeCompanyProfile(previous, s));
    setRegime(s.tenant.taxRegime || 'SIMPLES_NACIONAL');
    setMunicipal(s.tenant.municipalRegistration || '');
    setRate(simplesRateInput(s.tenant.simplesNacionalTaxRateBps, s.readiness.recommended || []) || '6,00');
    const taxes = approximateTaxInputs(s.approximateTaxes ?? s.tenant.approximateTaxes);
    setApproximateRate(taxes.rate); setApproximateTemplate(taxes.template);
    setBusinessType(s.tenant.businessType || '');
    setIssRate(typeof s.tenant.issRateBps === 'number' ? bpsToPercent(s.tenant.issRateBps) : '');
  }
  function handleError(e: unknown) {
    setError(e instanceof Error ? e.message : 'Não foi possível concluir.');
    setUnauthorized(e instanceof ApiError && e.status === 401);
    if (e instanceof ApiError && e.status === 401) {
      setUser(null);
      if (!new URLSearchParams(location.search).has('error')) window.location.replace('/api/login');
    }
    if (e instanceof ApiError && e.status === 422) {
      const errors: Record<string, string> = {};
      const details = e.details as any;
      const fields = Array.isArray(details) ? details : Array.isArray(details?.errors) ? details.errors : [];
      fields.forEach((item: any) => { if (item.field || item.path) errors[String(item.field || item.path)] = item.message || e.message; });
      if (details && !Array.isArray(details) && typeof details === 'object') {
        Object.entries(details).forEach(([key, value]) => { if (typeof value === 'string') errors[key] = value; });
      }
      if (!Object.keys(errors).length) {
        const relevant = step === 1 ? ['name','whatsapp'] : step === 2 ? ['file','password'] : step === 4 ? ['apiKey'] : [...missing, ...recommended.filter(item => isOptionalCompanyField(item.field) && (item.field === 'municipalRegistration' ? municipal.trim() : rate.trim())).map(item => item.field)];
        relevant.forEach(field => { errors[field] = e.message; });
      }
      setFieldErrors(errors);
    }
  }
  async function run(action: () => Promise<void>) {
    setError(''); setFieldErrors({}); setBusy(true);
    try { await action(); } catch (e) { handleError(e); } finally { setBusy(false); }
  }
  async function loadMe() {
    const me = await api('/app/me');
    setName(me.user?.name || me.name || user?.name || '');
    setPhone(me.user?.whatsapp || me.whatsapp || '');
    const existing = me.companies?.[0] as CompanyStatus | undefined;
    const entry = onboardingEntry(existing);
    setStep(entry.step);
    setView(entry.view);
    if (existing) {
      applyStatus(existing);
      const details = await api<CompanyStatus>(`/app/companies/${encodeURIComponent(existing.tenant.id)}`);
      const hydrated = mergeCompanyProfile(existing, details);
      applyStatus(hydrated);
      const detailedEntry = onboardingEntry(hydrated);
      setStep(detailedEntry.step);
      setView(detailedEntry.view);
    }
  }
  useEffect(() => {
    let mounted = true;
    api<unknown>('/auth/user').then(async u => {
      if (!mounted) return;
      if (!isAuthUser(u)) throw new ApiError(401, 'Entre com uma conta com e-mail válido para continuar.');
      setUser(u); setName(u.name);
      try { await loadMe(); } catch (e) { if (mounted) handleError(e); }
    }).catch(e => {
      if (!mounted) return;
      if (e instanceof ApiError && e.status === 401 && !new URLSearchParams(location.search).has('error')) {
        window.location.replace('/api/login');
        return;
      }
      handleError(e);
    })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (status?.availability.status === 'WAITLIST' || !id || !user) return;
    api<Billing>(`${base}/billing`).then(setBilling).catch(() => {});
  }, [id, view]);
  useEffect(() => {
    if (!id || step !== 5) return;
    api(`${base}/products?pendingTaxReview=true`).then(data => setProducts(Array.isArray(data) ? data : data.products ?? [])).catch(handleError);
  }, [id, step]);

  async function refreshPanel() {
    await run(async () => { const s = await api<CompanyStatus>(base); applyStatus(s); });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (step === 1) {
        if (phone.replace(/\D/g, '').length < 10) throw new Error('Informe um WhatsApp com DDD válido.');
        await api('/app/me', 'PUT', { name, whatsapp: phone }); setStep(2);
      } else if (step === 2) {
        if (!file) throw new Error('Escolha seu certificado digital.');
        const form = new FormData(); form.append('file', file); form.append('password', password);
        const s = await api<CompanyStatus>('/app/onboarding/certificate', 'POST', form);
        applyStatus(s); setPassword(''); setFile(null);
        if (s.availability.status !== 'WAITLIST') setStep(3);
      } else if (step === 3) {
        const editable = [...recommended, { field: 'municipalRegistration', message: '' }, ...(regime === 'SIMPLES_NACIONAL' ? [{ field: 'simplesNacionalTaxRateBps', message: '' }] : [])];
        const data: Record<string, unknown> = onboardingCompanyPatch(editable, { municipalRegistration: municipal, simplesNacionalTaxRateBps: rate }, status?.readiness.missing || []);
        data.approximateTaxes = approximateTaxPatch(approximateRate, approximateTemplate);
        Object.assign(data, fiscalCompanyPatch(status?.readiness.missing || [], { businessType, issRate }));
        if (regime && regime !== (status?.tenant.taxRegime || 'SIMPLES_NACIONAL')) data.taxRegime = regime;
        if (needsNumbering && advanced) { data.dpsSeries = series; data.nextDpsNumber = Number(nextNumber); }
        else if (needsNumbering) {
          if (!numbering) throw new Error('Informe se você já emite notas em outro sistema.');
          data.issuesElsewhere = numbering === 'yes';
        }
        const s = await api<CompanyStatus>(base, 'PATCH', data); applyStatus(s);
        if (!s.readiness.canIssue) throw new Error(s.readiness.missing.map(m => m.message).join('. ') || 'Confira as pendências da empresa.');
        setStep(3.1);
      } else if (step === 3.1) {
        if (!accountant.email && accountant.whatsapp.replace(/\D/g, '').length < 10) throw new Error('Informe pelo menos um contato válido do contador.');
        if (accountant.whatsapp && accountant.whatsapp.replace(/\D/g, '').length < 10) throw new Error('Informe o WhatsApp do contador com DDD.');
        await api(`${base}/accountant`, 'PUT', accountant); setAccountantSkipped(false);
        if (status) setStatus({ ...status, tenant: { ...status.tenant, accountant } });
        setStep(status?.tenant.integrations?.abacatepay ? 5 : 4);
      }
    });
  }
  const missing = status?.readiness.missing.map(m => m.field) || [];
  const recommended = status?.readiness.recommended || [];
  const needsNumbering = missing.includes('numbering');
  const isWaitlist = status?.availability.status === 'WAITLIST';
  const errorBox = error && <div className="app-alert" role="alert"><AlertTriangle size={18} /><div>{error}{unauthorized && <a href="/api/login">Entrar novamente <ArrowRight size={14} /></a>}{!unauthorized && <button type="button" onClick={() => run(loadMe)}>Tentar novamente</button>}</div></div>;
  if (loading) return <div className="app-loading"><Loader2 className="spin" size={28} /><p>Preparando seu espaço…</p></div>;
  if (!isAuthUser(user)) return <div className="login-page">
    <div className="login-nav"><Brand /><Link href="/">Voltar para o site <ArrowLeft size={16} /></Link></div>
    <main className="login-layout"><section className="login-story"><span className="app-eyebrow"><Leaf size={16} /> MENOS BUROCRACIA. MAIS VENDAS.</span><h1>Seu próximo passo.<br /><em>Não sua próxima<br />dor de cabeça.</em></h1><p>Deixe a nota fiscal com a gente.<br />Seu negócio tem coisa melhor pra fazer.</p><div className="login-note"><ShieldCheck size={22} /><span>Sem mensalidade.<br /><strong>Não vendeu, não pagou.</strong></span></div></section>
      <section className="login-card"><div className="login-icon"><Sparkles size={28} /></div><span className="app-eyebrow">BORA COMEÇAR?</span><h2>Seu negócio,<br />no automático.</h2><p>Entre na sua conta para configurar a empresa. É rápido e sem complicação.</p>
        {(error || new URLSearchParams(location.search).has('error')) && <div className="app-alert" role="alert">{error || 'Não foi possível entrar. Tente novamente em uma nova janela.'}</div>}
        <a className="app-primary google-login" href="/api/login"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.7 4.7 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.4ZM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 .9-3.4.9a6 6 0 0 1-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22ZM6.4 13.9A6 6 0 0 1 6.1 12c0-.7.1-1.3.3-1.9V7.5H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.5l3.3-2.6ZM12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.3 2.6A6 6 0 0 1 12 6Z"/></svg>Continuar com Google <ArrowRight size={18} /></a>
        <small>Login seguro via Replit Auth. Escolha Google na próxima tela.</small><div className="login-divider" /><div className="login-check"><Check size={16} /> Sem cartão de crédito</div><div className="login-check"><Check size={16} /> Seu certificado protegido</div><div className="login-check"><Check size={16} /> Você só paga por nota emitida</div>
      </section></main><div className="login-footer">açaínfe — seu negócio vende. a gente cuida da nota.</div></div>;

  return <div className="onboarding-page"><header className="app-header"><Brand /><div className="app-account"><span>{user.name || user.email}</span><button title="Sair" onClick={() => run(async () => { await api('/logout', 'POST'); setMcp(null); setUser(null); setStatus(null); })}><LogOut size={18} /></button></div></header>
    {billing?.status === 'BLOCKED' && <div className="blocked-banner" role="alert">Emissão pausada por saldo em aberto. A emissão de nota fiscal é obrigatória: enquanto estiver pausada, você pode ficar em desacordo com a legislação. Suas vendas continuam registradas e as notas saem automaticamente assim que o pagamento for confirmado. <button onClick={() => setView('billing')}>Pagar saldo</button></div>}
    <div className="app-body">
      {id && !isWaitlist && <nav className="app-tabs" aria-label="Área da empresa"><button className={view === 'wizard' ? 'active' : ''} onClick={() => setView('wizard')}><Sparkles size={16} /> Configuração</button><button className={view === 'panel' ? 'active' : ''} onClick={() => { setView('panel'); void refreshPanel(); }}><Building2 size={16} /> Painel</button><button className={view === 'fiscal' ? 'active' : ''} onClick={() => setView('fiscal')}><FileKey size={16} /> Dados fiscais</button><button className={view === 'billing' ? 'active' : ''} onClick={() => { setView('billing'); void run(async () => setBilling(await api(`${base}/billing`))); }}><Wallet size={16} /> Saldo</button></nav>}
      {isTestEnvironment(status?.emission, status?.tenant.environment) && <TestEnvironmentNotice environment="HOMOLOGATION" />}
      {isWaitlist ? <section className="app-card waitlist"><div className="login-icon"><Mail size={30} /></div><span className="app-eyebrow">VOCÊ JÁ ESTÁ NA LISTA</span><h1>Sua cidade é o<br />nosso próximo passo.</h1><CompanyCard status={status!} /><p>{status?.availability.reason || 'Sua cidade ainda não está liberada. Vamos te avisar por e-mail e WhatsApp assim que estiver tudo pronto.'}</p><p>Por enquanto, atendemos São Bernardo do Campo/SP, para Simples Nacional e MEI.</p>{errorBox}<button className="app-secondary" onClick={refreshPanel} disabled={busy}>Verificar disponibilidade</button></section>
      : view === 'fiscal' ? <FiscalSettings key={base} base={base} onUnauthorized={handleError} onChanged={() => { void refreshPanel(); }} />
      : view === 'billing' ? <section className="app-card"><span className="app-eyebrow">SEM MENSALIDADE. SEM SURPRESA.</span><h1>Seu saldo.</h1>{errorBox}{billing ? <><div className="balance-value">{brl(billing.amountDueCents)}</div><p>Você tem <strong>{brl(billing.openCents)}</strong> em aberto ({billing.openCharges} notas).{billing.blocksAt && <> Pague até <strong>{new Date(billing.blocksAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</strong> para manter a emissão ativa.</>}</p>{billing.overdue && <p className="danger-text">O pagamento está atrasado.</p>}{billing.creditCents > 0 && <div className="app-success">Você tem {brl(billing.creditCents)} de crédito para as próximas notas.</div>}<p className="app-muted">Cada nota custa {brl(billing.pricePerInvoiceCents)}. O saldo é avisado todo dia por e-mail e WhatsApp. Pix mínimo de R$ 1,00; a sobra vira crédito.</p>
      <button className="app-primary" disabled={busy || billing.amountDueCents <= 0} onClick={() => run(async () => setPix(await api(`${base}/billing/payments`, 'POST')))}>{busy ? <Loader2 className="spin" size={17} /> : <Wallet size={17} />} {billing.amountDueCents > 0 ? 'Pagar com Pix' : 'Tudo em dia'}</button>
      {pix && <div className="pix-section"><h2>Pix de {brl(pix.amountCents)}</h2>{/^data:image\/(png|jpeg|webp);base64,/.test(pix.pixQrCodeImage) && <img src={pix.pixQrCodeImage} alt="QR Code para pagamento Pix" />}<p>Expira em {new Date(pix.expiresAt).toLocaleString('pt-BR')}</p><div className="copy-field"><code>{pix.pixCopyPaste}</code><CopyButton text={pix.pixCopyPaste} /></div><button className="app-secondary" disabled={busy} onClick={() => run(async () => { const b = await api<Billing>(`${base}/billing`); setBilling(b); if (b.amountDueCents <= 0) setPix(null); })}>Verificar pagamento</button></div>}</> : <p>Não foi possível carregar o saldo. Use a aba Saldo para tentar novamente.</p>}</section>
      : view === 'panel' ? <section className="app-card"><span className="app-eyebrow">TUDO NO SEU LUGAR</span><h1>Seu negócio, por aqui.</h1>{errorBox}{status && <><CompanyCard status={status} onFiscalSettings={() => setView('fiscal')} /><div className="panel-grid"><div><small>Status da empresa</small><strong>{companyStatusLabel(status.tenant.status)}</strong></div><div><small>Emissão de notas</small><strong>{status.readiness.canIssue ? 'Empresa pronta' : 'Há pendências'}</strong></div><div><small>Produtos aguardando tributação</small><strong>{Array.isArray(status.pendingTaxReview) ? status.pendingTaxReview.length : status.pendingTaxReview}</strong></div><div><small>Validade do certificado</small><strong>{certificateExpiryLabel(status)}</strong></div></div>
       <AbacatePayWebhookCard
         base={base}
         integration={status.abacatepay}
         onReconnect={() => { setStep(4); setView('wizard'); }}
         onUnauthorized={handleError}
         onRefresh={refreshPanel}
       />
       {status.readiness.missing.length > 0 && <div className="app-notice"><h3>O que falta para emitir</h3><ul>{status.readiness.missing.map(m => <li key={m.field}>{m.message}</li>)}</ul><button className="app-secondary" onClick={() => { setStep(3); setView('wizard'); }}>Completar dados</button></div>}
       {recommended.length > 0 && <section className="company-recommendations" aria-labelledby="recommendations-title"><h3 id="recommendations-title">Complete quando puder</h3><p>Esses dados são recomendados e não impedem a emissão.</p><ul>{recommended.map(item => <li key={item.field}><span>{item.message}</span>{isOptionalCompanyField(item.field) ? <button className="app-secondary" type="button" disabled={busy} onClick={() => setEditingRecommendation({ ...item, field: item.field as OptionalCompanyField })}>Informar<span className="sr-only"> {item.field === 'municipalRegistration' ? 'CCM' : 'alíquota do Simples'}</span></button> : item.field === 'approximateTaxes' ? <button type="button" className="app-secondary" onClick={() => setView('fiscal')}>Conferir tributos</button> : null}</li>)}</ul></section>}
      {(accountantSkipped || !status.tenant.accountant) && <div className="app-notice"><h3>Seu contador já está por aqui?</h3><p>Cadastre um contato para receber os PDFs, XMLs e a planilha automaticamente todo dia 1.</p><button className="app-secondary" onClick={() => { setStep(3.1); setView('wizard'); }}>Adicionar contador</button></div>}<button className="app-secondary" onClick={refreshPanel} disabled={busy}>Atualizar status</button></>}</section>
      : <div className="wizard-layout"><aside className="wizard-aside"><span className="app-eyebrow">SÓ PRECISA CONFIGURAR UMA VEZ</span><h1>Vamos deixar<br />tudo <em>prontinho.</em></h1><p>Alguns passos agora.<br />Menos trabalho em cada venda.</p><ol>{steps.map((label, i) => <li key={label} className={Math.floor(step) === i + 1 ? 'current' : step > i + 1 ? 'complete' : ''}><span>{step > i + 1 ? <Check size={16} /> : String(i + 1).padStart(2, '0')}</span>{label}</li>)}</ol><div className="aside-secure"><ShieldCheck size={20} /><span>Seus dados protegidos.<br />Sua empresa no controle.</span></div></aside>
      <section className="app-card wizard-card"><div className="progress-label"><span>ETAPA {Math.floor(step)} DE 5</span><span>{Math.round(Math.floor(step) / 5 * 100)}%</span></div><div className="app-progress"><span style={{ width: `${Math.floor(step) * 20}%` }} /></div>
      {errorBox}
      {step === 4 ? <AbacatePayStep key={base} base={base} onConnected={connection => {
        setProducts(connection.pendingTaxReview || []);
        setStatus(current => current ? { ...current, tenant: { ...current.tenant, integrations: { ...current.tenant.integrations, abacatepay: true } } } : current);
      }} onContinue={() => setStep(5)} onUnauthorized={handleError} /> : <ValidationContext.Provider value={fieldErrors}><form onSubmit={submit}>
        {step === 1 && <><div className="step-icon"><Leaf /></div><h2>Primeiro, você.</h2><p>Como podemos te chamar? Vamos usar seu WhatsApp para avisos importantes sobre suas notas.</p><Field label="E-mail da sua conta"><input type="email" value={user.email} readOnly className="readonly" /></Field><Field label="Seu nome"><input value={name} onChange={e => setName(e.target.value)} autoComplete="name" required placeholder="Como você gosta de ser chamado?" /></Field><Field label="WhatsApp com DDD"><input value={phone} onChange={e => setPhone(phoneMask(e.target.value))} inputMode="tel" autoComplete="tel" required placeholder="(11) 99999-9999" /></Field></>}
        {step === 2 && <><div className="step-icon"><FileKey /></div><h2>Seu certificado A1.</h2><p>É o mesmo certificado que você usa para emitir notas ou acessar o e-CAC. Ele fica guardado criptografado e serve para assinar suas notas.</p><Field label="Arquivo do certificado" help="Formatos .pfx ou .p12, até 10 MB."><div className="upload-box"><FileKey size={28} /><strong>{file ? file.name : 'Selecione seu certificado'}</strong><input type="file" accept=".pfx,.p12" required onChange={e => { const f = e.target.files?.[0]; if (f && f.size > 10 * 1024 * 1024) { setError('O certificado deve ter até 10 MB.'); e.target.value = ''; setFile(null); } else setFile(f || null); }} /></div></Field><Field label="Senha do certificado"><input type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} required placeholder="A senha do seu arquivo A1" /></Field><div className="secure-note"><ShieldCheck size={17} /> Enviado com segurança. Nunca fica salvo no navegador.</div></>}
        {step === 3 && <><div className="step-icon"><Building2 /></div><h2>Só mais alguns detalhes.</h2><p>A Receita já contou quase tudo. Agora faltam as informações abaixo.</p>{status && <><CompanyCard status={status} /><div className="app-success"><Check size={17} /> Sua cidade já está liberada!</div></>}
          <Field label="Inscrição municipal (CCM)" help={status?.readiness.missing.find(item => item.field === 'municipalRegistration')?.message || recommended.find(item => item.field === 'municipalRegistration')?.message || `Opcional quando a prefeitura não exigir. ${municipalRegistrationHelp}`}><input value={municipal} onChange={e => setMunicipal(e.target.value)} required={missing.includes('municipalRegistration')} aria-required={missing.includes('municipalRegistration')} /></Field>
          {(regime === 'SIMPLES_NACIONAL' || missing.includes('simplesNacionalTaxRateBps') || recommended.some(item => item.field === 'simplesNacionalTaxRateBps')) && <Field label="Alíquota efetiva do Simples (%)" help="Valor padrão: 6%. Ajuste com seu contador. Não é o percentual dos tributos aproximados da Lei 12.741."><input value={rate} onChange={e => setRate(e.target.value)} inputMode="decimal" /></Field>}
          <ApproximateTaxesFields rate={approximateRate} template={approximateTemplate} onRate={setApproximateRate} onTemplate={setApproximateTemplate} recommended={recommended.some(item => item.field === 'approximateTaxes')} disabled={busy} errors={fieldErrors} />
          <section className="app-notice" aria-label="Sistema de emissão"><strong>Suas notas serão emitidas pelo: {status?.emission?.systemLabel || 'Sistema ainda não informado pela prefeitura'}</strong><p>Definido pela sua prefeitura. Peça ao seu contador para confirmar.</p></section>
          <Field label="Regime da empresa" help="Se veio errado, você pode corrigir aqui."><select value={regime} onChange={e => setRegime(e.target.value)}><option value="MEI">MEI</option><option value="SIMPLES_NACIONAL">Simples Nacional</option><option value="LUCRO_PRESUMIDO">Lucro Presumido</option><option value="LUCRO_REAL">Lucro Real</option></select></Field>
          <FiscalCompanyFields missing={status?.readiness.missing || []} businessType={businessType} issRate={issRate} onBusinessType={setBusinessType} onIssRate={setIssRate} errors={fieldErrors} disabled={busy} onUnauthorized={handleError} />
          {needsNumbering && <><fieldset className="numbering-options"><legend>Você já emite nota fiscal de serviço por outro sistema?</legend>{[['no', 'Não, vou começar agora'], ['yes', 'Sim, já emito']].map(([value, label]) => <label key={value}><input type="radio" name="numbering" value={value} checked={numbering === value} required={!advanced} disabled={advanced} onChange={() => setNumbering(value)} />{label}</label>)}{numbering === 'yes' && !advanced && <small>Usaremos a série exclusiva 900 para evitar números repetidos.</small>}{fieldErrors.numbering && <small className="danger-text">{fieldErrors.numbering}</small>}</fieldset>
          <button type="button" className="text-button" onClick={() => setAdvanced(!advanced)}>{advanced ? 'Usar configuração automática' : 'Prefiro informar a numeração'}</button>{advanced && <><p className="app-muted">Peça ao seu contador ou veja no seu emissor atual a série e o número da próxima nota.</p><div className="app-two-cols"><Field label="Série"><input value={series} onChange={e => setSeries(e.target.value)} required pattern="[0-9]+" inputMode="numeric" /></Field><Field label="Próximo número livre"><input type="number" min="1" step="1" value={nextNumber} onChange={e => setNextNumber(e.target.value)} required /></Field></div></>}</>}
          {status?.readiness.missing.filter(m => !['numbering', 'businessType', 'issRateBps', 'municipalRegistration', 'approximateTaxes', 'simplesNacionalTaxRateBps'].includes(m.field)).map(m => <p className="app-notice" key={m.field}>{m.message}</p>)}
        </>}
        {step === 3.1 && <><div className="step-icon"><Mail /></div><span className="app-eyebrow">UM EXTRA QUE FACILITA A VIDA</span><h2>Quem é seu contador?</h2><p>Todo mês o seu contador precisa das notas emitidas. A gente manda <strong>automaticamente, todo dia 1</strong>, por e-mail e WhatsApp: os PDFs, os XMLs e a planilha no formato necessário para ele. Você não precisa lembrar de nada.</p><Field label="Nome do contador ou escritório (opcional)"><input value={accountant.name} onChange={e => setAccountant({ ...accountant, name: e.target.value })} /></Field><Field label="E-mail do contador"><input type="email" value={accountant.email} onChange={e => setAccountant({ ...accountant, email: e.target.value })} /></Field><Field label="WhatsApp do contador" help="Precisamos de pelo menos um dos dois contatos."><input inputMode="tel" value={accountant.whatsapp} placeholder="(11) 99999-9999" onChange={e => setAccountant({ ...accountant, whatsapp: phoneMask(e.target.value) })} /></Field><button type="button" className="text-button" disabled={busy} onClick={() => { setAccountantSkipped(true); setStep(status?.tenant.integrations?.abacatepay ? 5 : 4); }}>Não tenho contador agora</button></>}
        {step === 5 && <><div className="step-icon"><Sparkles /></div><h2>Seu assistente<br />assume daqui.</h2><p>Emita, consulte, reenvie e cancele notas conversando. Conecte o açaínfe ao Claude ou a outro cliente MCP.</p>{products.length > 0 && <div className="app-notice">{products.length} produtos aguardam a definição do código de serviço. O assistente te ajuda no próximo passo.</div>}
          {!mcp ? <><Field label="Nome da chave (opcional)" help="Até 60 caracteres. Exemplo: Claude Code do notebook."><input value={mcpLabel} maxLength={60} disabled={busy} onChange={event => setMcpLabel(event.target.value)} /></Field><button type="button" className="app-primary" disabled={busy} onClick={() => void generateMcpKey()}>{busy ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}Gerar minha chave</button></> : <><div className="app-notice"><strong>Guarde esta chave: ela é exibida uma única vez e não será exibida de novo.</strong><p>Não compartilhe sua chave nem capturas desta tela. Ela não será salva no navegador.</p></div><Field label="Sua chave MCP"><div className="copy-field"><code>{mcp.apiKey}</code><CopyButton text={mcp.apiKey} /></div></Field><Field label="URL do servidor MCP"><div className="copy-field"><code>{mcp.mcpUrl}</code><CopyButton text={mcp.mcpUrl} /></div></Field>
            <div className="mcp-tabs" style={{ flexWrap: 'wrap' }}><button type="button" aria-pressed={client === 'code'} className={client === 'code' ? 'active' : ''} onClick={() => setClient('code')}>Claude Code</button><button type="button" aria-pressed={client === 'hermes'} className={client === 'hermes' ? 'active' : ''} onClick={() => setClient('hermes')}>Hermes (CLI)</button><button type="button" aria-pressed={client === 'desktop'} className={client === 'desktop' ? 'active' : ''} onClick={() => setClient('desktop')}>Claude Desktop / outros</button></div>
            {client === 'code' ? <><p>Cole este comando no terminal:</p><div className="copy-field command"><code>{mcp.claudeCodeCommand}</code><CopyButton text={mcp.claudeCodeCommand} /></div></> : client === 'hermes' ? <section aria-label="Conectar ao Hermes via CLI">
              <h3>Adicione o açaínfe ao Hermes</h3>
              <p>Com o Hermes Agent instalado, abra o terminal do seu computador (Bash ou Zsh, no macOS/Linux).</p>
              <ol>
                <li><p>Adicione o servidor com autenticação por chave:</p><div className="copy-field command"><code>{hermesMcpCommand(mcp.mcpUrl)}</code><CopyButton text={hermesMcpCommand(mcp.mcpUrl)} /></div></li>
                <li><p>Quando aparecer <code>API key / Bearer token</code>, cole somente sua chave MCP, sem escrever <code>Bearer</code>, e pressione Enter. A entrada fica oculta no terminal. Use o botão “Copiar” do campo “Sua chave MCP” acima.</p><p>Se já houver uma chave salva para esse servidor, o Hermes poderá reutilizá-la. Confirme a seleção das ferramentas que deseja habilitar.</p></li>
                <li><p>Teste a conexão:</p><div className="copy-field command"><code>hermes mcp test acainfe</code><CopyButton text="hermes mcp test acainfe" /></div><p>Depois, abra uma nova sessão do Hermes para usar as ferramentas do açaínfe.</p></li>
              </ol>
              <p>O comando não inclui sua chave, para não deixá-la no histórico do terminal. O Hermes salva a credencial no perfil local dele; proteja esse arquivo e não o compartilhe.</p>
              <a href="https://hermes-agent.nousresearch.com/docs/reference/cli-commands" target="_blank" rel="noopener noreferrer">Documentação oficial do Hermes</a>
            </section> : <><p>Adicione um servidor MCP remoto com transporte <strong>Streamable HTTP</strong>, a URL acima e este header:</p><div className="copy-field"><code>Authorization: Bearer {mcp.apiKey}</code><CopyButton text={`Authorization: Bearer ${mcp.apiKey}`} /></div></>}
            <div className="first-prompt"><Sparkles size={19} /><div><strong>Sua primeira conversa</strong><p>Use o prompt <code>configurar_empresa</code> ou diga: “quero definir a tributação dos meus produtos”.</p><CopyButton text="quero definir a tributação dos meus produtos" /></div></div><button type="button" disabled={busy} className="text-button" onClick={() => { if (confirm('Preparar uma nova chave? As anteriores continuam válidas. Copie sua chave atual antes de continuar.')) prepareMcpKey(); }}>Gerar outra chave (as anteriores continuam válidas)</button><button type="button" className="app-primary" onClick={() => { setMcp(null); setView('panel'); void refreshPanel(); }}>Ir para meu painel <ArrowRight size={18} /></button></>}
        </>}
        {step !== 5 && <div className="form-actions">{step === 2 && <button type="button" className="app-secondary" onClick={() => setStep(1)} disabled={busy}><ArrowLeft size={16} /> Voltar</button>}<button className="app-primary" type="submit" disabled={busy || (!!error && error.includes('ACAINFE_APP_KEY'))}>{busy ? <><Loader2 className="spin" size={17} /> Salvando…</> : <>{step === 2 ? 'Enviar certificado' : step === 3 ? 'Continuar' : 'Salvar e continuar'}<ArrowRight size={17} /></>}</button></div>}
      </form></ValidationContext.Provider>}
      {id && step === 5 && <McpKeysSection key={base} base={base} variant="onboarding"
        refreshToken={mcpRevision} onUnauthorized={handleError} onGenerate={prepareMcpKey} onRevoked={handleMcpRevoked} />}
      </section></div>}
      {id && !isWaitlist && view === 'panel' && <McpKeysSection
        key={base} base={base} refreshToken={mcpRevision} onUnauthorized={handleError}
        onGenerate={prepareMcpKey} onRevoked={handleMcpRevoked} />}
      <p className="app-bottom-note"><ShieldCheck size={14} /> Sem mensalidade. Não vendeu, não pagou.</p>
      {editingRecommendation && <CompanyRecommendationDialog base={base} item={editingRecommendation} onSaved={applyStatus} onClose={() => setEditingRecommendation(null)} onUnauthorized={handleError} />}
    </div></div>;
}
