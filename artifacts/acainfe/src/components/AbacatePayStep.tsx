import * as React from 'react';
import { AlertCircle, ArrowRight, ExternalLink, Leaf } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import type { AbacatePayConnection } from '../lib/past-sales';
import { AbacatePayImportSummary } from './AbacatePayImportSummary';
import { DefaultProductChoice } from './DefaultProductChoice';
import { PastSales } from './PastSales';
import { Products } from './Products';

type Props = {
  base: string;
  onConnected: (connection: AbacatePayConnection) => void;
  onContinue: () => void;
  onUnauthorized: (error: ApiError) => void;
};

export function AbacatePayStep({ base, onConnected, onContinue, onUnauthorized }: Props) {
  const [apiKey, setApiKey] = React.useState('');
  const [scan, setScan] = React.useState(true);
  const [scanned, setScanned] = React.useState(true);
  const [monthsBack, setMonthsBack] = React.useState('3');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [connection, setConnection] = React.useState<AbacatePayConnection | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [showProducts, setShowProducts] = React.useState(false);
  const [defaultSaved, setDefaultSaved] = React.useState(false);
  const busyRef = React.useRef(false);
  const errorId = React.useId();

  const key = apiKey.trim();
  const periods = connection?.pastSales?.periods ?? [];
  const warning = connection?.pastSales?.warning;
  const hasSales = scanned && !warning && periods.some(p => p.available.count > 0);
  const showForm = !connection || editing;
  const dp = connection?.defaultProduct;
  const needsDefault = !!connection && !!dp && dp.decided === false && !defaultSaved;
  const dpMissing = !!connection && (!dp || typeof dp.decided !== 'boolean' || (!dp.decided && (!Array.isArray(dp.options) || !dp.options.every(option => option && typeof option.id === 'string' && typeof option.name === 'string'))));

  async function connect() {
    if (busyRef.current) return;
    if (!key) { setError('Cole a API key do AbacatePay.'); return; }
    busyRef.current = true; setBusy(true); setError('');
    try {
      const body = scan ? { apiKey: key, scanPastSales: true, monthsBack: Number(monthsBack) } : { apiKey: key, scanPastSales: false };
      const result = await api<AbacatePayConnection>(`${base}/abacatepay`, 'POST', body);
      setDefaultSaved(false); setConnection(result); setScanned(scan); setEditing(false); setApiKey('');
      onConnected(result);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onUnauthorized(e);
      setError(e instanceof Error ? e.message : 'Não foi possível conectar. Tente novamente.');
    } finally { busyRef.current = false; setBusy(false); }
  }

  const openUpdate = () => { setEditing(true); setError(''); };
  const summary = connection && <AbacatePayImportSummary connection={connection} onOpenProducts={() => setShowProducts(v => !v)} />;
  const products = connection && showProducts && <div className="as-products">
    <Products base={base} onUnauthorized={onUnauthorized} />
  </div>;

  return <div className="abacatepay-step">
    <div className="step-icon"><Leaf /></div>
    <h2>Conecte seu AbacatePay</h2>
    <p>Com a conexão, cada venda aprovada vira nota fiscal automaticamente. Também buscamos as vendas que você já recebeu e que ainda estão sem nota.</p>

    {showForm && <form onSubmit={event => { event.preventDefault(); void connect(); }}>
      {connection && <p className="as-note">Sua conexão atual continua ativa. Informe a nova key para atualizar; não criamos outro webhook.</p>}
      <p>No painel do AbacatePay, crie uma API key com as permissões <strong>PRODUCT:READ</strong>, <strong>WEBHOOK:CREATE</strong>, <strong>CHECKOUT:READ</strong>, <strong>TRANSPARENT:READ</strong>, <strong>SUBSCRIPTION:READ</strong> e <strong>CUSTOMER:READ</strong>.</p>
      <a className="external-link" href="https://app.abacatepay.com" target="_blank" rel="noreferrer">Abrir painel do AbacatePay <ExternalLink size={15} /></a>
      <label className="app-field">Sua API key do AbacatePay
        <input type="password" value={apiKey} autoComplete="off" disabled={busy} placeholder="Cole sua chave aqui" required aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
          onChange={e => setApiKey(e.target.value)} />
        <small>Usada pelo servidor para criar o webhook, importar seus produtos e ler as vendas já recebidas. Fica guardada criptografada.</small>
      </label>
      {error && <div className="app-alert as-field-error" role="alert" id={errorId}><AlertCircle size={15} /><span>{error}</span></div>}
      <div className="as-block">
        <h3>Vendas antigas sem nota</h3>
        <label className="as-check">
          <input type="checkbox" checked={scan} disabled={busy} onChange={e => setScan(e.target.checked)} />
          <span>Buscar vendas já recebidas que ainda não têm nota</span>
        </label>
        {scan && <label className="app-field">Buscar desde
          <select value={monthsBack} disabled={busy} onChange={e => setMonthsBack(e.target.value)}>
            <option value="0">Este mês</option><option value="3">3 meses</option>
            <option value="6">6 meses</option><option value="12">12 meses</option>
          </select></label>}
        <small className="as-note">Só mostramos uma prévia. Nada é emitido sem você confirmar.</small>
      </div>
      <div className="as-actions">
        <button type="submit" className="app-primary" disabled={busy || !key}>
          {busy ? 'Conectando...' : 'Conectar AbacatePay'}</button>
        {connection && <button type="button" className="app-secondary" disabled={busy} onClick={() => { setEditing(false); setApiKey(''); setError(''); }}>Cancelar</button>}
      </div>
    </form>}

    {connection && !showForm && <>
      {summary}
      {warning && <div className="as-warning" role="status">
        <strong>A conexão funcionou, mas não conseguimos ler suas vendas antigas.</strong><br />{warning}
        <div><button type="button" className="app-secondary" onClick={openUpdate}>Atualizar key</button></div>
      </div>}
      {products}
      {dpMissing && <div className="as-warning" role="alert">A API não informou a escolha do produto padrão. Atualize a página e tente novamente.</div>}
      {needsDefault && !dpMissing && dp && <DefaultProductChoice base={base} options={dp.options} suggestedProductId={dp.suggestedProductId} decidedProductId={dp.productId} submitLabel="Salvar produto padrão" onUnauthorized={onUnauthorized}
        onSaved={decision => {
          setDefaultSaved(true);
          const updated = { ...connection, defaultProduct: { ...dp, ...decision } };
          setConnection(updated); onConnected(updated);
        }} />}
      {needsDefault ? <p className="as-note">Escolha uma opção acima para continuar.</p> : dpMissing ? null : hasSales
        ? <PastSales base={base} initial={connection.pastSales} onUpdateKey={openUpdate} onSkip={onContinue} onUnauthorized={onUnauthorized} />
        : <div className="as-actions">
            {!warning && <p className="as-note" style={{ flexBasis: '100%', margin: 0 }}>
              {scanned ? 'Não encontramos vendas sem nota no período escolhido.' : 'Você pulou a busca por vendas antigas.'}</p>}
            <button type="button" className="app-primary" onClick={onContinue}>Continuar <ArrowRight size={17} /></button>
          </div>}
    </>}
  </div>;
}
