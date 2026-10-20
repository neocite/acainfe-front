import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import '../payment-gateways.css';
import { api, ApiError } from '../lib/api';
import type { AbacatePayConnection } from '../lib/past-sales';
import { AbacatePayImportSummary } from './AbacatePayImportSummary';
import { AbacatePayKeyGuide } from './AbacatePayKeyGuide';
import { AbacatePayStep } from './AbacatePayStep';
import { AbacatePayWebhookCard, type Integration } from './AbacatePayWebhookCard';
import { PastSales } from './PastSales';
import { Products } from './Products';
import type { DefaultProductDecision } from '../lib/past-sales';

export type PaymentGatewaysIntegration = Integration & { defaultProduct?: DefaultProductDecision };
type Props = {
  base: string;
  integration?: PaymentGatewaysIntegration;
  onRefresh: () => Promise<void>;
  onUnauthorized: (error: unknown) => void;
  chooseToken?: number;
};
type View = 'overview' | 'connect' | 'past' | 'update';

export function PaymentGateways({ base, integration, onRefresh, onUnauthorized, chooseToken }: Props) {
  const [view, setView] = React.useState<View>('overview');
  const [reload, setReload] = React.useState(0);
  const connected = integration?.connected === true;
  const consumed = React.useRef(0);
  const [refreshError, setRefreshError] = React.useState('');
  const token = chooseToken && chooseToken !== consumed.current ? chooseToken : 0;
  React.useEffect(() => { consumed.current = chooseToken ?? 0; }, [chooseToken]);
  const back = () => setView('overview');
  const unauth = (e: ApiError) => onUnauthorized(e);

  return <section className="app-card pg-screen">
    <header>
      <span className="app-eyebrow">PAGAMENTOS E EMISSÃO</span>
      <h1>Gateways de pagamento</h1>
    </header>
    {view !== 'overview' && <button type="button" className="text-button pg-back" onClick={back}><ArrowLeft size={15} /> Voltar aos gateways</button>}

    {view === 'overview' && (connected
      ? <AbacatePayWebhookCard key={reload} base={base} integration={integration} defaultProduct={integration?.defaultProduct}
          chooseToken={token} onReconnect={() => setView('connect')} onUnauthorized={onUnauthorized} onRefresh={onRefresh}
          onUpdateKey={() => setView('update')} onPastSales={() => setView('past')} />
      : <AbacatePayWebhookCard base={base} integration={integration} onReconnect={() => setView('connect')}
          onUnauthorized={onUnauthorized} onRefresh={onRefresh} />)}

    {view === 'connect' && <AbacatePayStep base={base} completionLabel="Voltar aos gateways" onUnauthorized={unauth}
      onConnected={() => { setRefreshError(''); onRefresh().catch(e => {
        if (e instanceof ApiError && e.status === 401) onUnauthorized(e);
        setRefreshError(e instanceof Error ? e.message : 'Não foi possível atualizar os dados.');
      }); }} onContinue={back} />}

    {refreshError && <p className="danger-text" role="alert">{refreshError}</p>}

    {view === 'past' && <PastSales base={base} onUpdateKey={() => setView('update')} onSkip={back} onUnauthorized={unauth} />}

    {view === 'update' && <UpdateKey base={base} onCancel={back} onUnauthorized={onUnauthorized}
      onDone={async () => { consumed.current = chooseToken ?? 0; setReload(n => n + 1); await onRefresh(); }} />}

    {view === 'overview' && <section className="pg-soon"><h2>Outros gateways</h2><p>Em breve: outros gateways de pagamento. Quer usar outro? Fale com a gente.</p></section>}
  </section>;
}

function UpdateKey({ base, onCancel, onUnauthorized, onDone }: {
  base: string; onCancel: () => void; onUnauthorized: (e: unknown) => void; onDone: () => Promise<void>;
}) {
  const [apiKey, setApiKey] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [result, setResult] = React.useState<AbacatePayConnection | null>(null);
  const [products, setProducts] = React.useState(false);
  const lock = React.useRef(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const key = apiKey.trim();
    if (lock.current || !key) return;
    lock.current = true; setBusy(true); setError(''); setResult(null); setApiKey('');
    try {
      const res = await api<AbacatePayConnection>(`${base}/abacatepay`, 'POST', { apiKey: key, scanPastSales: true });
      if (!res || typeof res.imported !== 'number') throw new Error('A API não informou quantos produtos foram importados.');
      setResult(res);
      await onDone();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onUnauthorized(e);
      setError(e instanceof Error ? e.message : 'Não foi possível atualizar a key.');
    } finally { setApiKey(''); lock.current = false; setBusy(false); }
  }

  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return <section className="pg-update" aria-labelledby="pg-update-title">
    <h2 id="pg-update-title">Atualizar API key</h2>
    <p>Use quando a key mudou ou precisa de mais permissões. O webhook e o produto padrão continuam os mesmos.</p>
    <form className="pg-update" style={{ border: 0, padding: 0 }} onSubmit={e => { void submit(e); }}>
      <AbacatePayKeyGuide />
      <label className="app-field">Nova API key do AbacatePay
        <input type="password" autoComplete="off" value={apiKey} disabled={busy} placeholder="Cole sua chave aqui"
          onChange={e => setApiKey(e.target.value)} />
        <small>O açaínfe não guarda a key neste app; a conexão é gerenciada pela API.</small>
      </label>
      {error && <p className="danger-text" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="app-secondary" disabled={busy} onClick={onCancel}>{result ? 'Voltar' : 'Cancelar'}</button>
        <button type="submit" className="app-primary" disabled={busy || !apiKey.trim()}>{busy ? 'Atualizando…' : 'Atualizar key'}</button>
      </div>
    </form>
    {result && <div className="pg-result" role="status">
      <strong>{count(result.imported, 'produto importado', 'produtos importados')}.</strong>
      <small>{count(result.pendingTaxReview?.length ?? 0, 'produto aguarda', 'produtos aguardam')} confirmação fiscal.</small>
      <small>{count(result.skippedTestProducts?.length ?? 0, 'produto de teste ignorado', 'produtos de teste ignorados')}.</small>
      <small>{count(result.mergedDuplicates?.length ?? 0, 'duplicado unificado', 'duplicados unificados')}.</small>
      <AbacatePayImportSummary connection={result} onOpenProducts={() => setProducts(v => !v)} />
      {products && <Products base={base} onUnauthorized={e => onUnauthorized(e)} />}
    </div>}
  </section>;
}
