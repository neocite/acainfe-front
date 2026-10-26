import * as React from 'react';
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'wouter';
import { useUser, useClerk } from '@clerk/react';
import { ArrowRight, ArrowLeft, Check, ShieldCheck, FileKey, Sparkles, Bot, LogOut, Loader2, Wallet, Building2, AlertTriangle, Leaf, Mail } from 'lucide-react';
import { api, ApiError, phoneMask } from '../lib/api';
import { isOptionalCompanyField, onboardingCompanyPatch, simplesRateInput, municipalRegistrationHelp, type ReadinessItem, type OptionalCompanyField } from '../lib/company-details';
import { CompanyRecommendationDialog } from '../components/CompanyRecommendationDialog';
import { AbacatePayStep } from '../components/AbacatePayStep';
import { PaymentGateways } from '../components/PaymentGateways';
import { FiscalCompanyFields } from '../components/FiscalCompanyFields';
import { AiAgents } from '../components/AiAgents';
import { OnboardingAssistant } from '../components/OnboardingAssistant';
import { CopyButton } from '../components/CopyButton';
import { CompanyCard, TestEnvironmentNotice } from '../components/CompanyCard';
import { ApproximateTaxesFields } from '../components/ApproximateTaxesFields';
import { FiscalSettings } from '../components/FiscalSettings';
import { DefaultServiceEditor } from '../components/DefaultServiceEditor';
import { FiscalProfileWarning } from '../components/FiscalProfileWarning';
import type { FiscalSettings as FiscalSettingsData } from '../lib/fiscal-settings';
import { approximateTaxInputs, approximateTaxPatch, isTestEnvironment, type ApproximateTaxes, type Emission } from '../lib/fiscal-settings';
import { mergeCompanyProfile, companyStatusLabel, certificateExpiryLabel, type CompanyProfile } from '../lib/company-profile';
import { fiscalCompanyPatch } from '../lib/fiscal-profiles';
import { bpsToPercent } from '../lib/numbers';
import { isAuthUser, type AuthUser } from '../lib/auth';
import { onboardingEntry } from '../lib/onboarding-entry';
import { brl } from '../config/pricing';
import { useCoverage } from '../components/landing/use-coverage';
import { coverageWaitlist } from '../lib/coverage';
import { trackOnboarding, trackPixGenerated, type OnboardingStep } from '../lib/analytics';
import '../onboarding.css';
import '../mobile-fixes.css';
import '../company-details.css';
import '../abacatepay-step.css';
import '../abacatepay-webhook.css';
import '../past-sales.css';
import '../products.css';
import '../fiscal-company.css';
import '../mcp-keys.css';

type CompanyStatus = CompanyProfile & {
  tenant: { id: string; cnpj?: string; taxRegime?: string; municipalRegistration?: string | null; simplesNacionalTaxRateBps?: number | null; status?: string; integrations?: { abacatepay?: boolean }; certificateExpiresAt?: string; accountant?: unknown; businessType?: string | null; issRateBps?: number | null; environment?: string; approximateTaxes?: ApproximateTaxes | null };
  abacatepay?: { connected: boolean; connectedAt?: string | null; webhookEndpoint?: string | null; webhookUpToDate?: boolean | null; defaultProduct?: { decided: boolean; productId: string | null } };
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
const analyticsSteps: Record<number, OnboardingStep> = { 1: 'personal_details', 2: 'certificate', 3: 'company', 3.1: 'accountant', 4: 'abacatepay', 5: 'assistant' };
const ValidationContext = createContext<Record<string, string>>({});
const fieldNames: Record<string, string> = {
  'Seu nome': 'name', 'WhatsApp com DDD': 'whatsapp',
  'Arquivo do certificado': 'file', 'Senha do certificado': 'password',
  'Inscrição municipal (CCM)': 'municipalRegistration',
  'Alíquota efetiva do Simples (%)': 'simplesNacionalTaxRateBps',
  'Regime da empresa': 'taxRegime', 'Sua API key do AbacatePay': 'apiKey',
};
function Brand() { return <Link href="/" className="app-brand">açaínfe<span className="brand-dot" /></Link>; }
function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  const errors = useContext(ValidationContext);
  const error = errors[fieldNames[label] || label];
  return <label className="app-field"><span>{label}</span>{children}{help && <small>{help}</small>}{error && <small className="danger-text" role="alert">{error}</small>}</label>;
}
export default function Onboarding() {
  const coverage = useCoverage();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const user: AuthUser | null = clerkUser ? {
    id: clerkUser.externalId ?? clerkUser.id,
    email: clerkUser.primaryEmailAddress?.emailAddress || '',
    name: clerkUser.fullName || '',
  } : null;
  const [loading, setLoading] = useState(true);
  const [meLoaded, setMeLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [certificateError, setCertificateError] = useState<'invalid' | 'conflict' | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [editingRecommendation, setEditingRecommendation] = useState<(ReadinessItem & { field: OptionalCompanyField }) | null>(null);
  const [status, setStatus] = useState<CompanyStatus | null>(null);
  const [step, setStep] = useState(1);
  const [view, setView] = useState<'wizard' | 'panel' | 'gateways' | 'billing' | 'fiscal' | 'agents'>('wizard');
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
  const [fiscalDefaults, setFiscalDefaults] = useState<FiscalSettingsData['taxDefaults']>();
  const [customEditor, setCustomEditor] = useState(true);
  const [fiscalReviewSaved, setFiscalReviewSaved] = useState(false);
  const [customNotice, setCustomNotice] = useState('');
  const [customBusy, setCustomBusy] = useState(false);
  const [issRate, setIssRate] = useState('');
  const [numbering, setNumbering] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [series, setSeries] = useState('');
  const [nextNumber, setNextNumber] = useState('');
  const [accountant, setAccountant] = useState({ name: '', email: '', whatsapp: '' });
  const [accountantSkipped, setAccountantSkipped] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [pix, setPix] = useState<Pix | null>(null);
  const [initialOnboarding, setInitialOnboarding] = useState(false);
  const [analyticsRevision, setAnalyticsRevision] = useState(0);
  const seenSteps = React.useRef(new Set<number>());
  const completedSteps = React.useRef(new Set<OnboardingStep>());
  const analyticsStarted = React.useRef(false);
  const analyticsFinished = React.useRef(false);
  const id = status?.tenant.id;
  const base = `/app/companies/${encodeURIComponent(id || '')}`;

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
    if (initialOnboarding && view === 'wizard') trackOnboarding('onboarding_error', analyticsSteps[step], { httpStatus: e instanceof ApiError ? e.status : undefined });
    setError(e instanceof Error ? e.message : 'Não foi possível concluir.');
    if (step === 2 && e instanceof ApiError) {
      if (e.status === 409 && e.code === 'CONFLICT') { setCertificateError('conflict'); return; }
      if (e.status === 422 && e.code === 'CERTIFICATE_INVALID') { setCertificateError('invalid'); return; }
    }
    setUnauthorized(e instanceof ApiError && (e.status === 401 || e.status === 403));
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
    setError(''); setCertificateError(null); setFieldErrors({}); setBusy(true);
    try { await action(); } catch (e) { handleError(e); } finally { setBusy(false); }
  }
  async function loadMe() {
    const me = await api('/app/me');
    setName(me.user?.name || me.name || user?.name || '');
    setPhone(me.user?.whatsapp || me.whatsapp || '');
    const existing = me.companies?.[0] as CompanyStatus | undefined;
    const entry = onboardingEntry(existing);
    setInitialOnboarding(entry.view === 'wizard');
    setStep(entry.step);
    setView(entry.view);
    if (existing) {
      applyStatus(existing);
      const details = await api<CompanyStatus>(`/app/companies/${encodeURIComponent(existing.tenant.id)}`);
      const hydrated = mergeCompanyProfile(existing, details);
      applyStatus(hydrated);
      const detailedEntry = onboardingEntry(hydrated);
      setInitialOnboarding(detailedEntry.view === 'wizard');
      setStep(detailedEntry.step);
      setView(detailedEntry.view);
    }
    setMeLoaded(true);
  }
  useEffect(() => {
    let mounted = true;
    // PrivatePage mounts us only once Clerk has validated its cookie session.
    setName(user?.name || '');
    loadMe().catch(e => { if (mounted) handleError(e); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    const refresh = () => setAnalyticsRevision(value => value + 1);
    window.addEventListener('acainfe:analytics-consent', refresh);
    return () => window.removeEventListener('acainfe:analytics-consent', refresh);
  }, []);
  useEffect(() => {
    if (loading || !meLoaded || !initialOnboarding || view !== 'wizard') return;
    if (!analyticsStarted.current && trackOnboarding('onboarding_start')) analyticsStarted.current = true;
    if (status?.availability.status === 'WAITLIST') return;
    if (!seenSteps.current.has(step) && trackOnboarding('onboarding_step_view', analyticsSteps[step])) seenSteps.current.add(step);
  }, [loading, meLoaded, initialOnboarding, view, step, analyticsRevision, status?.availability.status]);
  function completeStep(name: OnboardingStep, skipped = false) {
    if (initialOnboarding && !completedSteps.current.has(name) && trackOnboarding('onboarding_step_complete', name, { skipped })) completedSteps.current.add(name);
  }
  async function generatePix() {
    await run(async () => {
      const result = await api<Pix>(`${base}/billing/payments`, 'POST');
      setPix(result);
      trackPixGenerated(result.amountCents, result.pixCopyPaste);
    });
  }
  useEffect(() => {
    if (status?.availability.status === 'WAITLIST' || !id || !user) return;
    api<Billing>(`${base}/billing`).then(setBilling).catch(() => {});
  }, [id, view]);
  useEffect(() => {
    if (!id || step !== 5) return;
    api(`${base}/products?pendingTaxReview=true`).then(data => setProducts(Array.isArray(data) ? data : data.products ?? [])).catch(handleError);
  }, [id, step]);
  useEffect(() => {
    if (!id || step !== 3) return;
    let active = true;
    api<FiscalSettingsData>(base + '/fiscal-settings').then(data => {
      if (active) setFiscalDefaults(data.taxDefaults);
    }).catch(e => { if (active) handleError(e); });
    return () => { active = false; };
  }, [id, step]);

  async function refreshPanel() {
    await run(async () => { const s = await api<CompanyStatus>(base); applyStatus(s); });
  }
  async function refreshGateways() {
    const s = await api<CompanyStatus>(base);
    applyStatus(s);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (customBusy) return;
    await run(async () => {
      if (step === 1) {
        if (phone.replace(/\D/g, '').length < 10) throw new Error('Informe um WhatsApp com DDD válido.');
        await api('/app/me', 'PUT', { name, whatsapp: phone }); completeStep('personal_details'); setStep(2);
      } else if (step === 2) {
        if (!file) throw new Error('Escolha seu certificado digital.');
        if (!/\.(pfx|p12)$/i.test(file.name)) throw new Error('Envie um certificado .pfx ou .p12.');
        if (!password) throw new Error('Informe a senha do certificado.');
        const form = new FormData(); form.append('file', file); form.append('password', password);
        const s = await api<CompanyStatus>('/app/onboarding/certificate', 'POST', form);
        applyStatus(s); setPassword(''); setFile(null);
        completeStep('certificate');
        if (initialOnboarding && s.availability.status === 'WAITLIST') trackOnboarding('onboarding_waitlisted', 'certificate');
        if (s.availability.status !== 'WAITLIST') setStep(3);
      } else if (step === 3) {
        const editable = [...recommended, { field: 'municipalRegistration', message: '' }, ...(regime === 'SIMPLES_NACIONAL' ? [{ field: 'simplesNacionalTaxRateBps', message: '' }] : [])];
        const data: Record<string, unknown> = onboardingCompanyPatch(editable, { municipalRegistration: municipal, simplesNacionalTaxRateBps: rate }, status?.readiness.missing || []);
        data.approximateTaxes = approximateTaxPatch(approximateRate, approximateTemplate);
        Object.assign(data, fiscalCompanyPatch(status?.readiness.missing || [], { businessType, issRate }));
        if (businessType) data.businessType = businessType;
        if (regime && regime !== (status?.tenant.taxRegime || 'SIMPLES_NACIONAL')) data.taxRegime = regime;
        if (needsNumbering && advanced) { data.dpsSeries = series; data.nextDpsNumber = Number(nextNumber); }
        else if (needsNumbering) {
          if (!numbering) throw new Error('Informe se você já emite notas em outro sistema.');
          data.issuesElsewhere = numbering === 'yes';
        }
        const s = await api<CompanyStatus>(base, 'PATCH', data); applyStatus(s);
        const fiscal = await api<FiscalSettingsData>(base + '/fiscal-settings');
        setFiscalDefaults(fiscal.taxDefaults);
        if (!s.readiness.canIssue) throw new Error(s.readiness.missing.map(m => m.message).join('. ') || 'Confira as pendências da empresa.');
        if (fiscal.taxDefaults?.warning) { setFiscalReviewSaved(true); return; }
        completeStep('company');
        setStep(3.1);
      } else if (step === 3.1) {
        if (!accountant.email && accountant.whatsapp.replace(/\D/g, '').length < 10) throw new Error('Informe pelo menos um contato válido do contador.');
        if (accountant.whatsapp && accountant.whatsapp.replace(/\D/g, '').length < 10) throw new Error('Informe o WhatsApp do contador com DDD.');
        await api(`${base}/accountant`, 'PUT', accountant); setAccountantSkipped(false);
        completeStep('accountant');
        if (status) setStatus({ ...status, tenant: { ...status.tenant, accountant } });
        setStep(status?.tenant.integrations?.abacatepay ? 5 : 4);
      }
    });
  }
  const missing = status?.readiness.missing.map(m => m.field) || [];
  const recommended = status?.readiness.recommended || [];
  const companyRecommendations = recommended.filter(item => item.field !== 'defaultProduct');
  const needsNumbering = missing.includes('numbering');
  const isWaitlist = status?.availability.status === 'WAITLIST';
  const certificateIssue = step === 2 ? certificateError : null;
  const errorBox = error && <div className="app-alert" role="alert"><AlertTriangle size={18} /><div>{error}{certificateIssue === 'invalid' && <p>Use o certificado A1 (e-CNPJ) emitido por uma autoridade certificadora credenciada (ex.: Soluti, Certisign, Serasa, Valid).</p>}{certificateIssue === 'conflict' && <p>Se você faz parte da empresa, peça a quem administra o açaínfe para liberar seu acesso.</p>}{unauthorized && <p>Não foi possível acessar seus dados. Tente novamente ou saia para usar outra conta.</p>}{!certificateIssue && <button type="button" onClick={() => run(loadMe)}>Tentar novamente</button>}</div></div>;
  if (loading) return <div className="app-loading"><Loader2 className="spin" size={28} /><p>Preparando seu espaço…</p></div>;
  if (!isAuthUser(user) || !meLoaded) return <main className="onboarding-page min-h-screen p-8"><Brand /><section className="app-card mx-auto mt-10 max-w-xl"><h1>Não foi possível carregar sua conta</h1>{errorBox || <p>Entre com uma conta com e-mail válido para continuar.</p>}<button className="app-secondary" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })}>Sair</button></section></main>;

  return <div className="onboarding-page" data-testid="app-data-loaded"><header className="app-header"><Brand /><div className="app-account"><Link href="/app/conta">{user.name || user.email}</Link><button title="Sair" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })}><LogOut size={18} /></button></div></header>
    {billing?.status === 'BLOCKED' && <div className="blocked-banner" role="alert">Emissão pausada por saldo em aberto. A emissão de nota fiscal é obrigatória: enquanto estiver pausada, você pode ficar em desacordo com a legislação. Suas vendas continuam registradas e as notas saem automaticamente assim que o pagamento for confirmado. <button onClick={() => setView('billing')}>Pagar saldo</button></div>}
    <div className="app-body">
      {id && !isWaitlist && <nav className="app-tabs" aria-label="Área da empresa">
        <button className={view === 'wizard' ? 'active' : ''} title="Certificado, dados pessoais e configuração inicial da empresa" onClick={() => setView('wizard')}><Sparkles size={16} /> Início</button>
        <button className={view === 'panel' || view === 'fiscal' ? 'active' : ''} onClick={() => { setView('panel'); void refreshPanel(); }}><Building2 size={16} /> Minha empresa</button>
        <button className={view === 'gateways' ? 'active' : ''} onClick={() => { setView('gateways'); void refreshPanel(); }}><Leaf size={16} /> Gateways de pagamento</button>
        <button className={view === 'agents' ? 'active' : ''} onClick={() => setView('agents')}><Bot size={16} /> Agentes de IA</button>
        <button className={view === 'billing' ? 'active' : ''} onClick={() => { setView('billing'); void run(async () => setBilling(await api(`${base}/billing`))); }}><Wallet size={16} /> Saldo</button>
      </nav>}
      {id && !isWaitlist && view === 'wizard' && <p className="app-tabs-note">Em Início ficam o envio do certificado, os dados pessoais e a configuração inicial da empresa. Conexões e vendas antigas estão em Gateways de pagamento.</p>}
      {id && !isWaitlist && view === 'wizard' && status && onboardingEntry(status).view === 'panel' && <label className="app-field configuration-review">Revisar configuração
        <select value={step} disabled={busy} onChange={event => setStep(Number(event.target.value))}>
          <option value={1}>Seus dados</option><option value={2}>Certificado A1</option><option value={3}>Sua empresa</option>
          <option value={3.1}>Contador</option><option value={4}>AbacatePay e vendas antigas</option><option value={5}>Primeira chave do assistente</option>
        </select>
      </label>}
      {isTestEnvironment(status?.emission, status?.tenant.environment) && <TestEnvironmentNotice environment="HOMOLOGATION" />}
      {isWaitlist ? <section className="app-card waitlist"><div className="login-icon"><Mail size={30} /></div><span className="app-eyebrow">VOCÊ JÁ ESTÁ NA LISTA</span><h1>Sua cidade é o<br />nosso próximo passo.</h1><CompanyCard status={status!} /><p>{status?.availability.reason || 'Sua cidade ainda não está liberada. Vamos te avisar por e-mail e WhatsApp assim que estiver tudo pronto.'}</p><p>{coverageWaitlist(coverage)}</p>{errorBox}<button className="app-secondary" onClick={refreshPanel} disabled={busy}>Verificar disponibilidade</button></section>
      : view === 'agents' ? <AiAgents key={base} base={base} onUnauthorized={handleError} />
      : view === 'gateways' ? <PaymentGateways key={base} base={base} integration={status?.abacatepay} onRefresh={refreshGateways} onUnauthorized={handleError} />
      : view === 'fiscal' ? <div className="company-fiscal-view"><nav className="company-section-nav" aria-label="Seção da empresa"><button type="button" className="text-button" onClick={() => setView('panel')}>Voltar para Minha empresa</button><span aria-hidden="true">/</span><span>Dados fiscais</span></nav><FiscalSettings key={base} base={base} businessType={status?.tenant.businessType} onUnauthorized={handleError} onChanged={() => { void refreshPanel(); }} /></div>
      : view === 'billing' ? <section className="app-card"><span className="app-eyebrow">SEM MENSALIDADE. SEM SURPRESA.</span><h1>Seu saldo.</h1>{errorBox}{billing ? <><div className="balance-value">{brl(billing.amountDueCents)}</div><p>Você tem <strong>{brl(billing.openCents)}</strong> em aberto ({billing.openCharges} notas).{billing.blocksAt && <> Pague até <strong>{new Date(billing.blocksAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</strong> para manter a emissão ativa.</>}</p>{billing.overdue && <p className="danger-text">O pagamento está atrasado.</p>}{billing.creditCents > 0 && <div className="app-success">Você tem {brl(billing.creditCents)} de crédito para as próximas notas.</div>}<p className="app-muted">Cada nota custa {brl(billing.pricePerInvoiceCents)}. O saldo é avisado todo dia por e-mail e WhatsApp. Pix mínimo de R$ 1,00; a sobra vira crédito.</p>
      <button className="app-primary" disabled={busy || billing.amountDueCents <= 0} onClick={() => void generatePix()}>{busy ? <Loader2 className="spin" size={17} /> : <Wallet size={17} />} {billing.amountDueCents > 0 ? 'Pagar com Pix' : 'Tudo em dia'}</button>
      {pix && <div className="pix-section"><h2>Pix de {brl(pix.amountCents)}</h2>{/^data:image\/(png|jpeg|webp);base64,/.test(pix.pixQrCodeImage) && <img src={pix.pixQrCodeImage} alt="QR Code para pagamento Pix" />}<p>Expira em {new Date(pix.expiresAt).toLocaleString('pt-BR')}</p><div className="copy-field"><code>{pix.pixCopyPaste}</code><CopyButton text={pix.pixCopyPaste} /></div><button className="app-secondary" disabled={busy} onClick={() => run(async () => { const b = await api<Billing>(`${base}/billing`); setBilling(b); if (b.amountDueCents <= 0) setPix(null); })}>Verificar pagamento</button></div>}</> : <p>Não foi possível carregar o saldo. Use a aba Saldo para tentar novamente.</p>}</section>
      : view === 'panel' ? <section className="app-card"><span className="app-eyebrow">TUDO NO SEU LUGAR</span><h1>Seu negócio, por aqui.</h1>{errorBox}{status && <><CompanyCard status={status} onFiscalSettings={() => setView('fiscal')} /><div className="panel-grid"><div><small>Status da empresa</small><strong>{companyStatusLabel(status.tenant.status)}</strong></div><div><small>Emissão de notas</small><strong>{status.readiness.canIssue ? 'Empresa pronta' : 'Há pendências'}</strong></div><div><small>Produtos aguardando tributação</small><strong>{Array.isArray(status.pendingTaxReview) ? status.pendingTaxReview.length : status.pendingTaxReview}</strong></div><div><small>Validade do certificado</small><strong>{certificateExpiryLabel(status)}</strong></div></div>
       {status.readiness.missing.length > 0 && <div className="app-notice"><h3>O que falta para emitir</h3><ul>{status.readiness.missing.map(m => <li key={m.field}>{m.message}</li>)}</ul><button className="app-secondary" onClick={() => { setStep(3); setView('wizard'); }}>Completar dados</button></div>}
       {companyRecommendations.length > 0 && <section className="company-recommendations" aria-labelledby="recommendations-title"><h3 id="recommendations-title">Complete quando puder</h3><p>Esses dados são recomendados e não impedem a emissão.</p><ul>{companyRecommendations.map(item => <li key={item.field}><span>{item.message}</span>{isOptionalCompanyField(item.field) ? <button className="app-secondary" type="button" disabled={busy} onClick={() => setEditingRecommendation({ ...item, field: item.field as OptionalCompanyField })}>Informar<span className="sr-only"> {item.field === 'municipalRegistration' ? 'CCM' : 'alíquota do Simples'}</span></button> : item.field === 'approximateTaxes' ? <button type="button" className="app-secondary" onClick={() => setView('fiscal')}>Conferir tributos</button> : null}</li>)}</ul></section>}
      {(accountantSkipped || !status.tenant.accountant) && <div className="app-notice"><h3>Seu contador já está por aqui?</h3><p>Cadastre um contato para receber os PDFs, XMLs e a planilha automaticamente todo dia 1.</p><button className="app-secondary" onClick={() => { setStep(3.1); setView('wizard'); }}>Adicionar contador</button></div>}<button className="app-secondary" onClick={refreshPanel} disabled={busy}>Atualizar status</button></>}</section>
      : <div className="wizard-layout"><aside className="wizard-aside"><span className="app-eyebrow">SÓ PRECISA CONFIGURAR UMA VEZ</span><h1>Vamos deixar<br />tudo <em>prontinho.</em></h1><p>Alguns passos agora.<br />Menos trabalho em cada venda.</p><ol>{steps.map((label, i) => <li key={label} className={Math.floor(step) === i + 1 ? 'current' : step > i + 1 ? 'complete' : ''}><span>{step > i + 1 ? <Check size={16} /> : String(i + 1).padStart(2, '0')}</span>{label}</li>)}</ol><div className="aside-secure"><ShieldCheck size={20} /><span>Seus dados protegidos.<br />Sua empresa no controle.</span></div></aside>
      <section className="app-card wizard-card"><div className="progress-label"><span>ETAPA {Math.floor(step)} DE 5</span><span>{Math.round(Math.floor(step) / 5 * 100)}%</span></div><div className="app-progress"><span style={{ width: `${Math.floor(step) * 20}%` }} /></div>
      {errorBox}
      {step === 4 ? <AbacatePayStep key={base} base={base} onConnected={connection => {
        setProducts(connection.pendingTaxReview || []);
        setStatus(current => current ? { ...current,
          abacatepay: { ...current.abacatepay, connected: true, defaultProduct: connection.defaultProduct },
          tenant: { ...current.tenant, integrations: { ...current.tenant.integrations, abacatepay: true } } } : current);
      }} onContinue={() => { completeStep('abacatepay'); setStep(5); }} onUnauthorized={handleError} /> : <ValidationContext.Provider value={fieldErrors}><form onSubmit={submit}>
        {step === 1 && <><div className="step-icon"><Leaf /></div><h2>Primeiro, você.</h2><p>Como podemos te chamar? Vamos usar seu WhatsApp para avisos importantes sobre suas notas.</p><Field label="E-mail da sua conta"><input type="email" value={user.email} readOnly className="readonly" /></Field><Field label="Seu nome"><input value={name} onChange={e => setName(e.target.value)} autoComplete="name" required placeholder="Como você gosta de ser chamado?" /></Field><Field label="WhatsApp com DDD"><input value={phone} onChange={e => setPhone(phoneMask(e.target.value))} inputMode="tel" autoComplete="tel" required placeholder="(11) 99999-9999" /></Field></>}
        {step === 2 && <><div className="step-icon"><FileKey /></div><h2>Seu certificado A1.</h2><p>É o mesmo certificado que você usa para emitir notas ou acessar o e-CAC. Ele fica guardado criptografado e serve para assinar suas notas.</p><Field label="Arquivo do certificado" help="Formatos .pfx ou .p12, até 10 MB."><div className="upload-box"><FileKey size={28} /><strong>{file ? file.name : 'Selecione seu certificado'}</strong><input type="file" accept=".pfx,.p12" required onChange={e => {
          setCertificateError(null); setError(''); setFieldErrors({});
          const f = e.target.files?.[0];
          if (f && (!/\.(pfx|p12)$/i.test(f.name) || f.size > 10 * 1024 * 1024)) {
            setError(f.size > 10 * 1024 * 1024 ? 'O certificado deve ter até 10 MB.' : 'Envie um certificado .pfx ou .p12.');
            e.target.value = ''; setFile(null);
          } else setFile(f || null);
        }} /></div></Field><Field label="Senha do certificado"><input type="password" autoComplete="off" value={password} onChange={e => setPassword(e.target.value)} required placeholder="A senha do seu arquivo A1" /></Field><div className="secure-note"><ShieldCheck size={17} /> Enviado com segurança. Nunca fica salvo no navegador.</div></>}
        {step === 3 && <><div className="step-icon"><Building2 /></div><h2>Só mais alguns detalhes.</h2><p>A Receita já contou quase tudo. Agora faltam as informações abaixo.</p>{status && <><CompanyCard status={status} /><div className="app-success"><Check size={17} /> Sua cidade já está liberada!</div></>}
          <Field label="Inscrição municipal (CCM)" help={status?.readiness.missing.find(item => item.field === 'municipalRegistration')?.message || recommended.find(item => item.field === 'municipalRegistration')?.message || `Opcional quando a prefeitura não exigir. ${municipalRegistrationHelp}`}><input value={municipal} onChange={e => setMunicipal(e.target.value)} required={missing.includes('municipalRegistration')} aria-required={missing.includes('municipalRegistration')} /></Field>
          {(regime === 'SIMPLES_NACIONAL' || missing.includes('simplesNacionalTaxRateBps') || recommended.some(item => item.field === 'simplesNacionalTaxRateBps')) && <Field label="Alíquota efetiva do Simples (%)" help="Valor padrão: 6%. Ajuste com seu contador. Não é o percentual dos tributos aproximados da Lei 12.741."><input value={rate} onChange={e => setRate(e.target.value)} inputMode="decimal" /></Field>}
          <ApproximateTaxesFields rate={approximateRate} template={approximateTemplate} onRate={setApproximateRate} onTemplate={setApproximateTemplate} recommended={recommended.some(item => item.field === 'approximateTaxes')} disabled={busy} errors={fieldErrors} />
          <section className="app-notice" aria-label="Sistema de emissão"><strong>Suas notas serão emitidas pelo: {status?.emission?.systemLabel || 'Sistema ainda não informado pela prefeitura'}</strong><p>Definido pela sua prefeitura. Peça ao seu contador para confirmar.</p></section>
          <Field label="Regime da empresa" help="Se veio errado, você pode corrigir aqui."><select value={regime} onChange={e => setRegime(e.target.value)}><option value="MEI">MEI</option><option value="SIMPLES_NACIONAL">Simples Nacional</option><option value="LUCRO_PRESUMIDO">Lucro Presumido</option><option value="LUCRO_REAL">Lucro Real</option></select></Field>
          <FiscalCompanyFields showBusiness missing={status?.readiness.missing || []} businessType={businessType} issRate={issRate} onBusinessType={value => { setBusinessType(value); setCustomEditor(true); setFiscalReviewSaved(false); setCustomNotice(''); }} onIssRate={setIssRate} errors={fieldErrors} disabled={busy || customBusy} onUnauthorized={handleError} />
          <FiscalProfileWarning warning={fiscalDefaults?.warning} busy={busy || customBusy} onCustom={() => void run(async () => {
            const s = await api<CompanyStatus>(base, 'PATCH', { businessType: 'CUSTOM' }); setStatus(previous => mergeCompanyProfile(previous, s));
            setBusinessType('CUSTOM'); setCustomEditor(true); setFiscalReviewSaved(false);
            const fiscal = await api<FiscalSettingsData>(base + '/fiscal-settings'); setFiscalDefaults(fiscal.taxDefaults);
          })} />
          {fiscalReviewSaved && <button type="button" className="text-button" disabled={busy} onClick={() => { completeStep('company'); setStep(3.1); }}>Continuar com a tributação como sugestão</button>}
          {businessType === 'CUSTOM' && customEditor && <DefaultServiceEditor key={JSON.stringify(fiscalDefaults)} base={base} system={status?.emission?.system} initial={fiscalDefaults} onUnauthorized={handleError}
            disabled={busy} onBusyChange={setCustomBusy}
            beforeSave={async () => {
              if (status?.tenant.businessType === 'CUSTOM') return;
              const s = await api<CompanyStatus>(base, 'PATCH', { businessType: 'CUSTOM' });
              setStatus(previous => mergeCompanyProfile(previous, s));
            }}
            onSkip={() => setCustomEditor(false)} onSaved={() => {
              setCustomEditor(false); setCustomNotice('Tributação padrão atualizada. Cada produto ainda precisa de confirmação.');
              void api<FiscalSettingsData>(base + '/fiscal-settings').then(data => setFiscalDefaults(data.taxDefaults)).catch(handleError);
            }} />}
          {businessType === 'CUSTOM' && !customEditor && <><p role="status">{customNotice || 'Você pode configurar a sugestão depois em Minha empresa → Dados fiscais.'}</p><button type="button" className="text-button" onClick={() => setCustomEditor(true)}>Editar tributação padrão</button></>}
          {needsNumbering && <><fieldset className="numbering-options"><legend>Você já emite nota fiscal de serviço por outro sistema?</legend>{[['no', 'Não, vou começar agora'], ['yes', 'Sim, já emito']].map(([value, label]) => <label key={value}><input type="radio" name="numbering" value={value} checked={numbering === value} required={!advanced} disabled={advanced} onChange={() => setNumbering(value)} />{label}</label>)}{numbering === 'yes' && !advanced && <small>Usaremos a série exclusiva 900 para evitar números repetidos.</small>}{fieldErrors.numbering && <small className="danger-text">{fieldErrors.numbering}</small>}</fieldset>
          <button type="button" className="text-button" onClick={() => setAdvanced(!advanced)}>{advanced ? 'Usar configuração automática' : 'Prefiro informar a numeração'}</button>{advanced && <><p className="app-muted">Peça ao seu contador ou veja no seu emissor atual a série e o número da próxima nota.</p><div className="app-two-cols"><Field label="Série"><input value={series} onChange={e => setSeries(e.target.value)} required pattern="[0-9]+" inputMode="numeric" /></Field><Field label="Próximo número livre"><input type="number" min="1" step="1" value={nextNumber} onChange={e => setNextNumber(e.target.value)} required /></Field></div></>}</>}
          {status?.readiness.missing.filter(m => !['numbering', 'businessType', 'issRateBps', 'municipalRegistration', 'approximateTaxes', 'simplesNacionalTaxRateBps'].includes(m.field)).map(m => <p className="app-notice" key={m.field}>{m.message}</p>)}
        </>}
        {step === 3.1 && <><div className="step-icon"><Mail /></div><span className="app-eyebrow">UM EXTRA QUE FACILITA A VIDA</span><h2>Quem é seu contador?</h2><p>Todo mês o seu contador precisa das notas emitidas. A gente manda <strong>automaticamente, todo dia 1</strong>, por e-mail e WhatsApp: os PDFs, os XMLs e a planilha no formato necessário para ele. Você não precisa lembrar de nada.</p><Field label="Nome do contador ou escritório (opcional)"><input value={accountant.name} onChange={e => setAccountant({ ...accountant, name: e.target.value })} /></Field><Field label="E-mail do contador"><input type="email" value={accountant.email} onChange={e => setAccountant({ ...accountant, email: e.target.value })} /></Field><Field label="WhatsApp do contador" help="Precisamos de pelo menos um dos dois contatos."><input inputMode="tel" value={accountant.whatsapp} placeholder="(11) 99999-9999" onChange={e => setAccountant({ ...accountant, whatsapp: phoneMask(e.target.value) })} /></Field><button type="button" className="text-button" disabled={busy} onClick={() => { completeStep('accountant', true); setAccountantSkipped(true); setStep(status?.tenant.integrations?.abacatepay ? 5 : 4); }}>Não tenho contador agora</button></>}
        {step === 5 && id && <OnboardingAssistant key={base} base={base} products={products.length} onUnauthorized={handleError} onManage={() => setView('agents')} onKeyCreated={() => { if (initialOnboarding) trackOnboarding('onboarding_mcp_key_created', 'assistant'); }} onDone={() => {
          if (initialOnboarding && !analyticsFinished.current) {
            completeStep('assistant');
            trackOnboarding('onboarding_complete');
            analyticsFinished.current = true;
          }
          setInitialOnboarding(false); setView('panel'); void refreshPanel();
        }} />}
        {step !== 5 && <div className="form-actions">{step === 2 && <button type="button" className="app-secondary" onClick={() => setStep(1)} disabled={busy}><ArrowLeft size={16} /> Voltar</button>}{certificateIssue !== 'conflict' && <button className="app-primary" type="submit" disabled={busy || customBusy || (!!error && error.includes('ACAINFE_APP_KEY'))}>{busy ? <><Loader2 className="spin" size={17} /> Salvando…</> : <>{step === 2 ? 'Enviar certificado' : step === 3 ? 'Continuar' : 'Salvar e continuar'}<ArrowRight size={17} /></>}</button>}</div>}
      </form></ValidationContext.Provider>}
      </section></div>}
      <p className="app-bottom-note"><ShieldCheck size={14} /> Sem mensalidade. Não vendeu, não pagou.</p>
      {editingRecommendation && <CompanyRecommendationDialog base={base} item={editingRecommendation} onSaved={applyStatus} onClose={() => setEditingRecommendation(null)} onUnauthorized={handleError} />}
    </div></div>;
}
