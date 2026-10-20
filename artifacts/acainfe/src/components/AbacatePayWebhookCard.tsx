import * as React from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { AbacatePayKeyGuide } from './AbacatePayKeyGuide';
import { DefaultProductChoice } from './DefaultProductChoice';
import { getProducts, type Product } from '../lib/products';
import type { DefaultProductDecision } from '../lib/past-sales';
import { CopyButton } from './CopyButton';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';

export type Integration = {
  connected: boolean;
  connectedAt?: string | null;
  webhookEndpoint?: string | null;
  webhookUpToDate?: boolean | null;
};

type WebhookResult = {
  webhookId: string;
  endpoint: string;
  previous?: { webhookId?: string; endpoint?: string | null } | null;
};

type Props = {
  base: string;
  integration?: Integration;
  onReconnect: () => void;
  onUnauthorized: (error: unknown) => void;
  onRefresh: () => Promise<void>;
  defaultProduct?: DefaultProductDecision;
  chooseToken?: number;
  onUpdateKey?: () => void;
  onPastSales?: () => void;
};

function dateLabel(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}

export function AbacatePayWebhookCard({ base, integration, onReconnect, onUnauthorized, onRefresh, defaultProduct, chooseToken, onUpdateKey, onPastSales }: Props) {
  const [choiceOpen, setChoiceOpen] = React.useState(false);
  const [list, setList] = React.useState<Product[] | null>(null);
  const [listError, setListError] = React.useState('');
  const isConnected = integration?.connected === true;
  const loadList = React.useCallback(() => {
    setListError('');
    getProducts(`${base}/products`).then(setList).catch(e => {
      if (e instanceof ApiError && e.status === 401) onUnauthorized(e);
      setListError(e instanceof Error ? e.message : 'Não foi possível carregar os produtos.');
    });
  }, [base]);
  React.useEffect(() => { if (isConnected) loadList(); }, [isConnected, loadList]);
  const lastToken = React.useRef<number | undefined>(undefined);
  React.useEffect(() => { if (isConnected && chooseToken && chooseToken !== lastToken.current) { lastToken.current = chooseToken; setChoiceOpen(true); } }, [chooseToken, isConnected]);
  const dpName = !defaultProduct ? 'Não informado pela API' : !defaultProduct.decided ? 'Pendente' : defaultProduct.productId === null ? 'Nenhum (esses pagamentos não geram nota)' : list ? (list.find(p => p.id === defaultProduct.productId)?.name ?? 'Produto não encontrado na lista') : listError ? 'Não foi possível consultar o nome' : 'Carregando…';
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [apiKey, setApiKey] = React.useState('');
  const [needsApiKey, setNeedsApiKey] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [created, setCreated] = React.useState<WebhookResult | null>(null);
  const lock = React.useRef(false);

  function openDialog() {
    setCreated(null);
    setError('');
    setApiKey('');
    setNeedsApiKey(false);
    setDialogOpen(true);
  }

  function closeDialog() {
    if (lock.current) return;
    setDialogOpen(false);
    setApiKey('');
    setNeedsApiKey(false);
    setError('');
  }

  async function recreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || (needsApiKey && !apiKey.trim())) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await api<WebhookResult>(
        `${base}/abacatepay/webhook`,
        'POST',
        needsApiKey ? { apiKey: apiKey.trim() } : undefined,
      );
      setCreated(result);
      setApiKey('');
      setNeedsApiKey(false);
      setDialogOpen(false);
      await onRefresh();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized(cause);
      const message = cause instanceof Error ? cause.message : 'Não foi possível recriar o webhook.';
      if (message.toUpperCase().includes('WEBHOOK:CREATE')) {
        setNeedsApiKey(true);
        setError('A API key conectada não tem a permissão necessária. Informe uma chave com WEBHOOK:CREATE.');
      } else {
        setError(message);
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const connected = integration?.connected === true;
  const connectedDate = dateLabel(integration?.connectedAt);
  const oldEndpoint = created?.previous?.endpoint || 'o endereço antigo';

  return <>
    <section className="ap-webhook-card" aria-labelledby="abacatepay-integration-title">
      <div className="ap-webhook-heading">
        <div>
          <span className="app-eyebrow">PAGAMENTOS E EMISSÃO</span>
          <h2 id="abacatepay-integration-title">Integração AbacatePay</h2>
        </div>
        {connected && integration?.webhookUpToDate === true && (
          <span className="ap-webhook-status ap-webhook-status-ok"><CheckCircle2 size={16} /> Webhook ativo</span>
        )}
        {connected && integration?.webhookUpToDate === false && (
          <span className="ap-webhook-status ap-webhook-status-warn"><AlertTriangle size={16} /> Webhook desatualizado</span>
        )}
      </div>

      {!connected ? <>
        <p>AbacatePay não conectado.</p>
        <button type="button" className="app-primary" onClick={onReconnect}>Conectar AbacatePay</button>
      </> : <>
        <p className="ap-webhook-connected">
          {connectedDate ? `Conectado desde ${connectedDate}` : 'AbacatePay conectado'}
        </p>
        <div className="ap-webhook-endpoint">
          <span>Produto padrão:</span>
          <strong>{dpName}</strong>
          {listError && <p className="danger-text" role="alert">{listError} <button type="button" className="text-button" onClick={loadList}>Tentar novamente</button></p>}
          <button type="button" className="app-secondary" disabled={!list} onClick={() => setChoiceOpen(true)}>Alterar</button>
        </div>
        {integration?.webhookEndpoint && (
          <div className="ap-webhook-endpoint">
            <span>Endereço do webhook</span>
            <code>{integration.webhookEndpoint}</code>
            <CopyButton text={integration.webhookEndpoint} />
          </div>
        )}
        <p className="app-muted">Use “Recriar webhook” se as vendas pararam de chegar ou se o webhook estiver desatualizado. Depois, apague o webhook antigo no painel do AbacatePay.</p>
        {integration?.webhookUpToDate === false ? (
          <div className="ap-webhook-warning" role="alert">
            <AlertTriangle size={18} />
            <div>
              <p>O webhook do AbacatePay aponta para um endereço antigo. As vendas novas não estão virando nota. Recrie o webhook.</p>
              <button type="button" className="app-primary" onClick={openDialog}>Recriar webhook</button>
            </div>
          </div>
        ) : integration?.webhookUpToDate !== true ? (
          <div className="ap-webhook-neutral">
            <p>Se as vendas pararam de virar nota, recrie o webhook.</p>
            <button type="button" className="app-secondary" onClick={openDialog}>Recriar webhook</button>
          </div>
        ) : (
          <div className="ap-webhook-neutral">
            <p>Precisa trocar o endereço do webhook? Você pode recriá-lo a qualquer momento.</p>
            <button type="button" className="app-secondary" onClick={openDialog}>Recriar webhook</button>
          </div>
        )}
        {(onUpdateKey || onPastSales) && <div className="ap-webhook-extra">
          {onPastSales && <button type="button" className="app-secondary" onClick={onPastSales}>Vendas sem nota</button>}
          {onUpdateKey && <button type="button" className="app-secondary" onClick={onUpdateKey}>Atualizar API key</button>}
        </div>}
      </>}

      {created && (
        <div className="ap-webhook-created" role="status" aria-live="polite">
          <p className="ap-webhook-created-title"><CheckCircle2 size={17} /> Webhook novo criado.</p>
          <p><strong>Agora apague o webhook antigo</strong> no painel do AbacatePay (Configurações → Webhooks), aquele que aponta para <code>{oldEndpoint}</code>. Ele não recebe mais nada.</p>
          <a href="https://app.abacatepay.com" target="_blank" rel="noreferrer">
            Abrir painel do AbacatePay <ExternalLink size={14} />
          </a>
        </div>
      )}
      {error && !dialogOpen && <p className="danger-text" role="alert">{error}</p>}
    </section>

    <Dialog open={choiceOpen} onOpenChange={setChoiceOpen}>
      <DialogContent className="company-recommendation-dialog default-product-dialog">
        <DialogTitle>Produto padrão</DialogTitle>
        <DialogDescription>Escolha o produto usado em pagamentos sem produto.</DialogDescription>
        {list && <DefaultProductChoice base={base} options={list} decided={defaultProduct?.decided} decidedProductId={defaultProduct?.productId} submitLabel="Salvar"
          onUnauthorized={onUnauthorized} onCancel={() => setChoiceOpen(false)}
          onSaved={async () => { await onRefresh(); setChoiceOpen(false); }} />}
      </DialogContent>
    </Dialog>

    <Dialog open={dialogOpen} onOpenChange={open => { if (!open) closeDialog(); }}>
      <DialogContent className="company-recommendation-dialog ap-webhook-dialog">
        <DialogTitle>Recriar webhook do AbacatePay?</DialogTitle>
        <DialogDescription>
          Vamos criar um webhook novo no AbacatePay apontando para o endereço atual do açaínfe. O antigo deixa de funcionar.
        </DialogDescription>
        <form onSubmit={event => { void recreate(event); }}>
        {needsApiKey && <>
          <p className="ap-webhook-key-intro">Crie uma API key com as permissões necessárias e informe abaixo.</p>
          <a className="external-link" href="https://app.abacatepay.com" target="_blank" rel="noreferrer">
            Abrir painel do AbacatePay <ExternalLink size={14} />
          </a>
          <AbacatePayKeyGuide />
          <label className="app-field" htmlFor="abacatepay-webhook-api-key">
            API key do AbacatePay
            <input
              id="abacatepay-webhook-api-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              disabled={busy}
              onChange={event => setApiKey(event.target.value)}
              placeholder="Cole sua API key aqui"
            />
            <small>Usada apenas para criar o webhook. Não será salva no navegador.</small>
          </label>
        </>}
        {error && <p className="danger-text ap-webhook-error" role="alert">{error}</p>}
        <div className="form-actions ap-webhook-dialog-actions">
          <button type="button" className="app-secondary" disabled={busy} onClick={closeDialog}>Cancelar</button>
          <button type="submit" className="app-primary" disabled={busy || (needsApiKey && !apiKey.trim())}>
            {busy ? <><RefreshCw className="spin" size={16} /> Criando…</> : needsApiKey ? 'Recriar webhook' : 'Confirmar e criar webhook'}
          </button>
        </div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
