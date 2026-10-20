import * as React from 'react';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Loader2, Copy, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { ApproximateTaxesFields } from './ApproximateTaxesFields';
import { ApiError, api, phoneMask } from '../lib/api';
import { bpsToPercent, percentToBps } from '../lib/numbers';
import { approximateTaxInputs, approximateTaxPatch, isTestEnvironment, type FiscalSettings as Settings } from '../lib/fiscal-settings';
import '../fiscal-settings.css';

const NI = 'Não informado';
const txt = (v: unknown) => (v === undefined || v === null || String(v).trim() === '' ? NI : String(v));
const yn = (v: boolean | undefined | null) => (v === undefined || v === null ? NI : v ? 'Sim' : 'Não');
const STATUS: Record<string, string> = { READY: 'Pronto', OK: 'Pronto', COMPLETE: 'Completo', PENDING: 'Pendente', INCOMPLETE: 'Incompleto', MISSING: 'Faltando', ACTIVE: 'Ativo', INACTIVE: 'Inativo', NEEDS_REVIEW: 'Precisa de revisão', PENDING_REVIEW: 'Aguardando revisão', PENDING_TAX_REVIEW: 'Aguardando revisão fiscal', CONFIRMED: 'Confirmado', BLOCKED: 'Bloqueado', ERROR: 'Com erro', VALIDATED: 'Validado', NOT_VALIDATED: 'Não validado' };
const statusLabel = (s?: string) => (s ? STATUS[s.toUpperCase()] ?? s : NI);
const SOURCE = { INFORMED: 'informado', SIMPLES_ESTIMATE: 'estimado pela parcela do ISS no Simples', NOT_SET: 'não definido' } as const;
const fmtDate = (s?: string | null) => { if (!s) return NI; const d = new Date(s); return isNaN(+d) ? 'Data não informada' : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }); };
const accountantPhone = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return phoneMask(/^55\d{10,11}$/.test(digits) ? digits.slice(2) : digits);
};
const emailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const errMsg = (e: unknown, fb: string) => (e instanceof Error && e.message ? e.message : fb);

function Row({ k, children }: { k: string; children: ReactNode }) { return <><dt>{k}</dt><dd>{children}</dd></>; }
function Card({ title, onEdit, editLabel, wide, children }: { title: string; onEdit?: () => void; editLabel?: string; wide?: boolean; children: ReactNode }) {
  return <section className={`fs-card${wide ? ' wide' : ''}`} aria-label={title}><header><h2>{title}</h2>
    {onEdit && <button type="button" className="fs-edit" onClick={onEdit} aria-label={editLabel}>Editar</button>}</header>{children}</section>;
}
function Shell({ open, title, desc, onClose, busy, children }: { open: boolean; title: string; desc: string; onClose: () => void; busy: boolean; children: ReactNode }) {
  return <Dialog open={open} onOpenChange={o => { if (!o && !busy) onClose(); }}><DialogContent className="fs-dialog" style={{ maxHeight: '90dvh', overflowY: 'auto' }}>
    <DialogTitle>{title}</DialogTitle><DialogDescription>{desc}</DialogDescription>{children}</DialogContent></Dialog>;
}
function Actions({ busy, onCancel }: { busy: boolean; onCancel: () => void }) {
  return <div className="form-actions"><button className="app-secondary" type="button" disabled={busy} onClick={onCancel}>Cancelar</button>
    <button className="app-primary" type="submit" disabled={busy}>{busy && <Loader2 size={17} className="spin" />}{busy ? 'Salvando…' : 'Salvar'}</button></div>;
}

export function FiscalSettings({ base, onUnauthorized, onChanged }: { base: string; onUnauthorized: (error: unknown) => void; onChanged?: () => void }) {
  const [data, setData] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [dialog, setDialog] = useState<'company' | 'taxes' | 'accountant' | null>(null);
  const [busyAction, setBusyAction] = useState<'copy' | 'send' | null>(null);
  const reqId = useRef(0);
  const lock = useRef(false);
  const authRef = useRef(onUnauthorized); authRef.current = onUnauthorized;
  const changedRef = useRef(onChanged); changedRef.current = onChanged;

  const fetchSettings = useCallback(async (): Promise<Settings | null> => {
    const id = ++reqId.current;
    try {
      const res = await api<Settings>(base + '/fiscal-settings');
      if (id !== reqId.current) return null;
      setData(res); setLoadError(''); return res;
    } catch (e) {
      if (id !== reqId.current) return null;
      if (e instanceof ApiError && e.status === 401) authRef.current(e);
      throw e;
    }
  }, [base]);

  const load = useCallback(() => {
    setLoading(true); setLoadError(''); setData(null);
    fetchSettings().catch(e => setLoadError(errMsg(e, 'Não foi possível carregar os dados fiscais.'))).finally(() => { setLoading(false); });
  }, [fetchSettings]);
  useEffect(() => { load(); return () => { reqId.current++; }; }, [load]);

  async function refreshAfterSave(msg: string) {
    changedRef.current?.();
    try { await fetchSettings(); setNotice({ ok: true, text: msg }); }
    catch { setNotice({ ok: false, text: 'Salvamos, mas não conseguimos atualizar a tela. Recarregue para conferir.' }); }
  }

  async function copy() {
    if (lock.current || !data) return; lock.current = true; setBusyAction('copy'); setNotice(null);
    try {
      const text = data.text;
      if (typeof text !== 'string') throw new Error('Resumo indisponível.');
      await navigator.clipboard.writeText(text);
      setNotice({ ok: true, text: 'Resumo copiado.' });
    } catch (e) { setNotice({ ok: false, text: errMsg(e, 'Não foi possível copiar o resumo.') + ' Tente novamente.' }); }
    finally { lock.current = false; setBusyAction(null); }
  }

  async function send() {
    if (lock.current) return; lock.current = true; setBusyAction('send'); setNotice(null);
    try {
      const r = await api<{ sentTo?: { email?: string | null; whatsapp?: string | null } }>(base + '/fiscal-settings/send', 'POST');
      const parts = [r.sentTo?.email && `e-mail ${r.sentTo.email}`, r.sentTo?.whatsapp && `WhatsApp ${r.sentTo.whatsapp}`].filter(Boolean);
      setNotice({ ok: true, text: parts.length ? `Enviado para ${parts.join(' e ')}.` : 'Resumo enviado ao contador.' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) authRef.current(e);
      const m = errMsg(e, 'Não foi possível enviar ao contador.');
      setNotice({ ok: false, text: m });
      if (/contador|accountant/i.test(m) && /cadastr|falt|inform|defin|contato|configur|missing|not.*found|encontr|ausen|nenhum|não (há|existe)/i.test(m) && !(e instanceof ApiError && e.status === 401)) setDialog('accountant');
    } finally { lock.current = false; setBusyAction(null); }
  }

  if (loading) return <div className="fs-wrap" aria-busy="true" aria-label="Carregando dados fiscais"><div className="fs-grid"><div className="fs-skel" /><div className="fs-skel" /><div className="fs-skel" /><div className="fs-skel" /></div></div>;
  if (loadError || !data) return <div className="fs-wrap"><div className="app-alert" role="alert"><AlertCircle size={16} /><div>{loadError || 'Não encontramos dados fiscais.'}<button type="button" onClick={load}>Tentar novamente</button></div></div></div>;

  const { company: c, emission: em } = data;
  const missing = data.readiness?.missing ?? [], recommended = data.readiness?.recommended ?? [];
  const ccmRequired = missing.some(i => i.field === 'municipalRegistration');
  const test = isTestEnvironment(em);
  const envLabel = test ? 'Modo teste' : em?.environment === 'PRODUCTION' ? 'Produção' : NI;
  const td = data.taxDefaults, cert = data.certificate, acc = data.accountant;
  const hasAcc = !!(acc?.email || acc?.whatsapp);
  const products = data.products ?? [];
  const cnaes = c.cnaes ?? [];

  return <div className="fs-wrap">
    <div className="fs-top"><div><span className="app-eyebrow">PARA CONFERIR COM SEU CONTADOR</span><h1>Dados fiscais</h1></div>
      <div className="fs-actions">
        <button className="app-secondary" type="button" onClick={copy} disabled={busyAction !== null}>{busyAction === 'copy' ? <Loader2 size={15} className="spin" /> : <Copy size={15} />}Copiar resumo</button>
        <button className="app-primary" type="button" onClick={send} disabled={busyAction !== null}>{busyAction === 'send' ? <Loader2 size={15} className="spin" /> : <Send size={15} />}{busyAction === 'send' ? 'Enviando…' : 'Enviar ao contador'}</button>
      </div></div>
    <div className="fs-status" aria-live="polite">{notice && (notice.ok
      ? <div className="app-success"><CheckCircle2 size={16} />{notice.text}</div>
      : <div className="app-alert" role="alert"><AlertCircle size={16} />{notice.text}</div>)}</div>

    <div className="fs-grid">
      <Card title="Empresa" onEdit={() => setDialog('company')} editLabel="Editar inscrição municipal e alíquota do Simples">
        <dl><Row k="CNPJ">{txt(c.cnpj)}</Row><Row k="Razão social">{txt(c.legalName)}</Row><Row k="Nome fantasia">{txt(c.tradeName)}</Row>
          <Row k="Inscrição municipal (CCM)">{txt(c.municipalRegistration)}</Row>
          <Row k="Cidade">{c.city?.name ? `${c.city.name}${c.city.uf ? ' / ' + c.city.uf : ''}` : NI}{c.city?.code && <span className="fs-muted"> (IBGE {c.city.code})</span>}</Row>
          <Row k="Regime tributário">{txt(c.taxRegimeLabel)}</Row>
          <Row k="Alíquota do Simples">{typeof c.simplesNacionalTaxRateBps === 'number' ? <>{bpsToPercent(c.simplesNacionalTaxRateBps)}%{c.simplesRateIsEstimate && <span className="fs-muted"> (estimativa)</span>}</> : NI}</Row>
          <Row k="Atividades (CNAE)">{cnaes.length ? <ul className="fs-list" style={{ margin: 0 }}>{cnaes.map(n => <li key={n.code} style={{ background: 'transparent', border: 0, padding: 0 }}>{n.code} - {n.description}{n.primary && <> <span className="fs-badge">Principal</span></>}</li>)}</ul> : NI}</Row></dl>
      </Card>

      <Card title="Emissão">
        <p className="fs-muted">Definido pela sua prefeitura. Peça ao seu contador para confirmar.</p>
        <dl><Row k="Sistema">{txt(em?.systemLabel)}</Row>
          <Row k="Ambiente">{test ? <span className="fs-badge test">Modo teste</span> : envLabel}</Row>
          <Row k="Aprovação antes de emitir">{yn(em?.approvalRequired)}</Row>
          <Row k="Série">{txt(em?.series)}</Row><Row k="Próximo número">{txt(em?.nextNumber)}</Row></dl>
      </Card>

      <Card title="Tributação padrão dos produtos">
        {td ? <dl><Row k="Perfil">{txt(td.profileLabel)}</Row>
          <Row k="Validado">{td.validated === undefined ? NI : <span className={`fs-badge ${td.validated ? 'ok' : 'bad'}`}>{td.validated ? 'Validado' : 'Não validado'}</span>}</Row>
          <Row k="Serviço nacional">{txt(td.nationalServiceCode)}</Row><Row k="Serviço municipal">{txt(td.localServiceCode)}</Row><Row k="NBS">{txt(td.nbsCode)}</Row>
          <Row k="Retenção de ISS">{typeof td.issRetention === 'boolean' ? yn(td.issRetention) : txt(td.issRetention)}</Row>
          <Row k="IBS/CBS - CST">{txt(td.ibsCbs?.cst)}</Row><Row k="IBS/CBS - classificação">{txt(td.ibsCbs?.cClassTrib)}</Row>
          <Row k="IBS/CBS - operação">{txt(td.ibsCbs?.operationIndicator)}</Row></dl>
          : <div className="fs-empty">Nenhuma tributação padrão definida ainda.</div>}
      </Card>

      <Card title="ISS">
        {data.issRate ? <dl><Row k="Alíquota">{typeof data.issRate.bps === 'number' ? `${bpsToPercent(data.issRate.bps)}%` : NI}</Row>
          <Row k="Origem">{SOURCE[data.issRate.source] ?? NI}</Row></dl> : <div className="fs-empty">Alíquota de ISS não definida.</div>}
      </Card>

      <Card title="Tributos aproximados" onEdit={() => setDialog('taxes')} editLabel="Editar tributos aproximados">
        {data.approximateTaxes ? <dl><Row k="Percentual">{bpsToPercent(data.approximateTaxes.rateBps)}%</Row><Row k="Texto na nota">{txt(data.approximateTaxes.descriptionTemplate)}</Row></dl>
          : <div className="fs-empty">Ainda não configurado. Toda nota precisa informar o valor aproximado dos tributos.</div>}
      </Card>

      <Card title="Certificado A1">
        {cert?.present ? <dl><Row k="Instalado">Sim</Row><Row k="Validade">{fmtDate(cert.expiresAt)}</Row>
          <Row k="Situação">{cert.expired === undefined ? NI : <span className={`fs-badge ${cert.expired ? 'bad' : 'ok'}`}>{cert.expired ? 'Vencido' : 'Válido'}</span>}</Row>
          <Row k="Dias para vencer">{typeof cert.daysUntilExpiry === 'number' ? cert.daysUntilExpiry : NI}</Row></dl>
          : <div className="fs-empty">{cert ? 'Nenhum certificado A1 enviado.' : NI}</div>}
      </Card>

      <Card title="Contador" onEdit={() => setDialog('accountant')} editLabel="Editar contador">
        {hasAcc || acc?.name ? <dl><Row k="Nome">{txt(acc?.name)}</Row><Row k="E-mail">{txt(acc?.email)}</Row><Row k="WhatsApp">{acc?.whatsapp ? accountantPhone(acc.whatsapp) : NI}</Row></dl>
          : <div className="fs-empty">Nenhum contador cadastrado. Adicione um e-mail ou WhatsApp para enviar este resumo.</div>}
      </Card>

      {missing.length + recommended.length > 0 && <Card title="Pendências">
        {missing.length + recommended.length === 0 ? <div className="fs-empty">Nenhuma pendência. Tudo certo por aqui.</div> : <>
          {missing.length > 0 && <ul className="fs-list missing" aria-label="Obrigatórias">{missing.map((i, n) => <li key={i.field + n}>{i.message}</li>)}</ul>}
          {recommended.length > 0 && <ul className="fs-list" style={{ marginTop: 8 }} aria-label="Recomendadas">{recommended.map((i, n) => <li key={i.field + n}>{i.message}</li>)}</ul>}</>}
      </Card>}

      <Card title="Produtos" wide>
        {products.length === 0 ? <div className="fs-empty">Nenhum produto cadastrado ainda.</div> :
          <div className="fs-scroll"><table className="fs-table stack"><thead><tr><th>Produto</th><th>Status</th><th>Serviço nacional</th><th>Serviço municipal</th><th>NBS</th><th>Avisos</th></tr></thead><tbody>
            {products.map((p, i) => <tr key={p.name + i}><td data-l="Produto"><strong>{txt(p.name)}</strong></td><td data-l="Status">{statusLabel(p.status)}</td>
              <td data-l="Serviço nacional">{txt(p.nationalServiceCode)}</td><td data-l="Serviço municipal">{txt(p.localServiceCode)}</td><td data-l="NBS">{txt(p.nbsCode)}</td>
              <td data-l="Avisos">{p.warnings?.length ? p.warnings.map((w, k) => <div className="fs-warn" key={k}>{w}</div>) : <span className="fs-muted">Sem avisos</span>}</td></tr>)}
          </tbody></table></div>}
      </Card>
    </div>

    {dialog === 'company' && <CompanyDialog base={base} data={data} required={ccmRequired} onClose={() => setDialog(null)} onUnauthorized={e => authRef.current(e)} onSaved={() => { setDialog(null); void refreshAfterSave('Dados da empresa atualizados.'); }} />}
    {dialog === 'taxes' && <TaxesDialog base={base} data={data} onClose={() => setDialog(null)} onUnauthorized={e => authRef.current(e)} onSaved={() => { setDialog(null); void refreshAfterSave('Tributos aproximados atualizados.'); }} />}
    {dialog === 'accountant' && <AccountantDialog base={base} data={data} onClose={() => setDialog(null)} onUnauthorized={e => authRef.current(e)} onSaved={() => { setDialog(null); void refreshAfterSave('Contador atualizado. Toque em Enviar ao contador para mandar o resumo.'); }} />}
  </div>;
}

type DProps = { base: string; data: Settings; onClose: () => void; onSaved: () => void; onUnauthorized: (e: unknown) => void };

function useSubmit(onUnauthorized: (e: unknown) => void) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [fields, setFields] = useState<Record<string, string>>({});
  const lock = useRef(false);
  async function run(fn: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setFields({});
    try { await fn(); } catch (e) {
      setError(errMsg(e, 'Não foi possível salvar. Tente novamente.'));
      if (e instanceof ApiError) { if (e.status === 401) onUnauthorized(e); if (e.details && typeof e.details === 'object') setFields(e.details as Record<string, string>); }
    } finally { lock.current = false; setBusy(false); }
  }
  return { busy, error, setError, fields, run };
}

function CompanyDialog({ base, data, required, onClose, onSaved, onUnauthorized }: DProps & { required: boolean }) {
  const c = data.company;
  const [ccm, setCcm] = useState(c.municipalRegistration ?? '');
  const [rate, setRate] = useState(typeof c.simplesNacionalTaxRateBps === 'number' ? bpsToPercent(c.simplesNacionalTaxRateBps) : '');
  const s = useSubmit(onUnauthorized);
  function submit(ev: FormEvent) {
    ev.preventDefault();
    void s.run(async () => {
      const patch: Record<string, unknown> = {};
      if (required && !ccm.trim()) throw new Error('Informe a inscrição municipal (CCM).');
      if (ccm.trim()) patch.municipalRegistration = ccm.trim();
      if (rate.trim()) {
        const bps = percentToBps(rate);
        if (bps === null || bps > 3300) throw new Error('Informe a alíquota do Simples entre 0 e 33%.');
        patch.simplesNacionalTaxRateBps = bps;
      }
      if (!Object.keys(patch).length) throw new Error('Preencha ao menos um campo para salvar.');
      await api(base, 'PATCH', patch); onSaved();
    });
  }
  return <Shell open title="Editar empresa" desc="Você pode ajustar a inscrição municipal e a alíquota do Simples. Confirme com seu contador." onClose={onClose} busy={s.busy}>
    <form onSubmit={submit} noValidate>
      <label className="app-field"><span>Inscrição municipal (CCM){required ? '' : ' (opcional)'}</span><input value={ccm} onChange={e => setCcm(e.target.value)} required={required} disabled={s.busy} /></label>
      <label className="app-field"><span>Alíquota do Simples Nacional (%)</span><input inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} disabled={s.busy} placeholder="0 a 33" /><small>Entre 0% e 33%.</small></label>
      {s.error && <p className="danger-text" role="alert">{s.error}</p>}
      <Actions busy={s.busy} onCancel={onClose} />
    </form></Shell>;
}

function TaxesDialog({ base, data, onClose, onSaved, onUnauthorized }: DProps) {
  const init = approximateTaxInputs(data.approximateTaxes);
  const [rate, setRate] = useState(init.rate); const [template, setTemplate] = useState(init.template);
  const s = useSubmit(onUnauthorized);
  function submit(ev: FormEvent) {
    ev.preventDefault();
    void s.run(async () => { await api(base, 'PATCH', { approximateTaxes: approximateTaxPatch(rate, template) }); onSaved(); });
  }
  return <Shell open title="Editar tributos aproximados" desc="Percentual e texto que aparecem em cada nota." onClose={onClose} busy={s.busy}>
    <form onSubmit={submit} noValidate>
      <ApproximateTaxesFields rate={rate} template={template} onRate={setRate} onTemplate={setTemplate} disabled={s.busy} errors={s.fields} recommended={!data.approximateTaxes} />
      {s.error && <p className="danger-text" role="alert">{s.error}</p>}
      <Actions busy={s.busy} onCancel={onClose} />
    </form></Shell>;
}

function AccountantDialog({ base, data, onClose, onSaved, onUnauthorized }: DProps) {
  const a = data.accountant;
  const [name, setName] = useState(a?.name ?? ''); const [email, setEmail] = useState(a?.email ?? ''); const [wa, setWa] = useState(a?.whatsapp ? accountantPhone(a.whatsapp) : '');
  const s = useSubmit(onUnauthorized);
  function submit(ev: FormEvent) {
    ev.preventDefault();
    void s.run(async () => {
      const digits = wa.replace(/\D/g, '');
      if (!email.trim() && !digits) throw new Error('Informe o e-mail ou o WhatsApp do contador.');
      if (email.trim() && !emailOk(email.trim())) throw new Error('Informe um e-mail válido.');
      if (digits && (digits.length < 10 || digits.length > 11)) throw new Error('Informe o WhatsApp com DDD, por exemplo (11) 91234-5678.');
      const body: Record<string, string> = {};
      if (name.trim()) body.name = name.trim();
      if (email.trim()) body.email = email.trim();
      if (digits) body.whatsapp = digits;
      await api(base + '/accountant', 'PUT', body); onSaved();
    });
  }
  return <Shell open title="Contador" desc="Informe o e-mail, o WhatsApp ou os dois. Usamos para enviar o resumo fiscal." onClose={onClose} busy={s.busy}>
    <form onSubmit={submit} noValidate>
      <label className="app-field"><span>Nome (opcional)</span><input value={name} onChange={e => setName(e.target.value)} disabled={s.busy} autoComplete="name" /></label>
      <label className="app-field"><span>E-mail</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={s.busy} autoComplete="email" /></label>
      <label className="app-field"><span>WhatsApp com DDD</span><input inputMode="tel" value={wa} onChange={e => setWa(phoneMask(e.target.value))} disabled={s.busy} placeholder="(11) 91234-5678" /></label>
      {s.error && <p className="danger-text" role="alert">{s.error}</p>}
      <Actions busy={s.busy} onCancel={onClose} />
    </form></Shell>;
}

export default FiscalSettings;
