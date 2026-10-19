import * as React from 'react';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { PastSalesPeriodCard } from './PastSalesPeriodCard';
import { PastSalesReview } from './PastSalesReview';
import { getProducts } from '../lib/products';
import { getPastSales, issuePastSales, pastPeriodWarning, sortedPeriods, type PastSalesPreview, type PastSalesPeriod, type PastSalesResult, type SaleProduct } from '../lib/past-sales';

type Props = { base: string; initial?: PastSalesPreview | null; onUpdateKey: () => void; onSkip: () => void; onUnauthorized: (error: ApiError) => void };
export function PastSales({ base, initial, onUpdateKey, onSkip, onUnauthorized }: Props) {
  const [preview, setPreview] = useState<PastSalesPreview>(initial || {});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [price, setPrice] = useState<number | null>(null);
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [productError, setProductError] = useState('');
  const [fallbacks, setFallbacks] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, PastSalesResult>>({});
  const [review, setReview] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<PastSalesPeriod | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  function report(e: unknown) {
    setError(e instanceof Error ? e.message : 'Não foi possível carregar as vendas.');
    if (e instanceof ApiError && e.status === 401) onUnauthorized(e);
  }
  async function refresh() { setPreview(await getPastSales(base)); }
  async function loadPrice() {
    const pricing = await api<{ pricePerInvoiceCents: number }>('/public/pricing');
    if (!Number.isSafeInteger(pricing.pricePerInvoiceCents) || pricing.pricePerInvoiceCents < 0) throw new Error('Não foi possível confirmar o custo da emissão.');
    setPrice(pricing.pricePerInvoiceCents);
  }
  async function loadProducts() {
    setProducts(await getProducts(`${base}/products`));
    setProductError('');
  }
  function reportProducts(e: unknown) {
    setProductError('A importação foi concluída, mas não foi possível consultar a lista de produtos para o Pix avulso. ' + (e instanceof Error ? e.message : 'Tente novamente.'));
    if (e instanceof ApiError && e.status === 401) onUnauthorized(e);
  }
  async function retryProducts() {
    if (busy) return;
    setBusy(true);
    try { await loadProducts(); } catch (e) { reportProducts(e); } finally { setBusy(false); }
  }
  useEffect(() => {
    let mounted = true;
    getPastSales(base).then(data => { if (mounted) setPreview(data); })
      .catch(e => { if (mounted) report(e); }).finally(() => { if (mounted) setLoading(false); });
    loadPrice().catch(e => { if (mounted) report(e); });
    return () => { mounted = false; };
  }, [base]);
  useEffect(() => {
    if (initial) setPreview(initial);
  }, [initial]);
  const needsProducts = (preview.periods || []).some(period => period.available.withoutItems > 0);
  useEffect(() => {
    if (needsProducts) loadProducts().catch(reportProducts);
  }, [base, needsProducts]);
  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (e) { report(e); } finally { setBusy(false); }
  }
  async function issue(period: PastSalesPeriod, accepted: boolean) {
    await perform(async () => {
      const result = await issuePastSales(base, period, accepted, fallbacks[period.period]);
      setResults(previous => ({ ...previous, [period.period]: result }));
      setConfirmation(null); setConfirmed(false);
      await refresh();
    });
  }
  return <div className="past-sales">
    <span className="app-eyebrow">VENDAS SEM NOTA · OPCIONAL</span>
    <h2>Encontramos vendas sem nota fiscal</h2>
    <p>Revise antes de emitir: vendas que já têm nota no portal da prefeitura ou em outro sistema devem ser marcadas manualmente. Estornos e contestações não entram.</p>
    {preview.warning && <div className="app-notice" role="status"><p>{preview.warning}</p><p>A conexão funcionou. Atualize a chave para permitir a leitura das vendas passadas.</p><button type="button" className="app-secondary" disabled={busy || !!review} onClick={onUpdateKey}>Atualizar key</button></div>}
    {error && <div className="app-alert" role="alert">{error}<button type="button" className="text-button" disabled={busy} onClick={() => void perform(async () => { await Promise.all([refresh(), loadPrice()]); })}>Tentar novamente</button></div>}
    {needsProducts && productError && <div className="app-alert" role="alert">{productError}<button type="button" className="text-button" disabled={busy} onClick={() => void retryProducts()}>Carregar produtos novamente</button></div>}
    {loading && <p role="status">Buscando vendas sem nota…</p>}
    {sortedPeriods(preview).map(period => <PastSalesPeriodCard key={period.period} period={period} price={price} products={products}
      fallback={fallbacks[period.period] || ''} busy={busy || loading || !!review} result={results[period.period]}
      onFallback={value => setFallbacks(previous => ({ ...previous, [period.period]: value }))}
      onReview={() => setReview(period.period)}
      onIssue={() => {
        if (period.requiresConfirmation) { setConfirmation(period); setConfirmed(false); }
        else void issue(period, false);
      }} />)}
    {!loading && !preview.warning && preview.periods?.length === 0 && <div className="app-success">Nenhuma venda sem nota encontrada no período consultado.</div>}
    {review && <PastSalesReview key={review} base={base} period={review} onChanged={refresh} onClose={() => setReview(null)} onUnauthorized={onUnauthorized} />}
    <div className="past-sales-actions">
      <button type="button" className="app-secondary" disabled={busy || !!review} onClick={() => void perform(async () => {
        await api(`${base}/past-sales/scan`, 'POST', { monthsBack: 3 });
        await Promise.all([refresh(), loadPrice()]);
      })}>{busy ? 'Atualizando…' : 'Atualizar lista'}</button>
      <button type="button" className="text-button" disabled={busy || !!review} onClick={onUpdateKey}>Atualizar key</button>
      <button type="button" className="app-primary" disabled={busy || !!review} onClick={onSkip}>Agora não <span aria-hidden="true">→</span></button>
    </div>
    <Dialog open={!!confirmation} onOpenChange={open => { if (!open && !busy) { setConfirmation(null); setConfirmed(false); } }}>
      <DialogContent className="company-recommendation-dialog past-sales-confirmation">
        <DialogTitle>Confirmar emissão de mês anterior</DialogTitle>
        <DialogDescription>{confirmation ? pastPeriodWarning(confirmation.period) : ''}</DialogDescription>
        {error && <p className="danger-text" role="alert">{error}</p>}
        <label className="past-sales-confirm-checkbox"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /> Entendi e quero emitir</label>
        <div className="past-sales-actions"><button type="button" className="app-secondary" disabled={busy} onClick={() => { setConfirmation(null); setConfirmed(false); }}>Cancelar</button><button type="button" className="app-primary" disabled={!confirmed || busy} onClick={() => { if (confirmation) void issue(confirmation, confirmed); }}>{busy ? 'Enviando…' : 'Emitir'}</button></div>
      </DialogContent>
    </Dialog>
  </div>;
}

export function PastSalesPanelCard({ base, onOpen, onUpdateKey, onUnauthorized }: {
  base: string; onOpen: () => void; onUpdateKey: () => void; onUnauthorized: (error: ApiError) => void;
}) {
  const [preview, setPreview] = useState<PastSalesPreview | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    getPastSales(base).then(data => { if (mounted) setPreview(data); }).catch(e => {
      if (!mounted) return;
      setError(e instanceof Error ? e.message : 'Não foi possível consultar as vendas.');
      if (e instanceof ApiError && e.status === 401) onUnauthorized(e);
    });
    return () => { mounted = false; };
  }, [base]);
  const count = (preview?.periods || []).reduce((sum, period) => sum + period.available.count, 0);
  return <section className="app-notice past-sales-panel-card"><h3>Vendas sem nota</h3>
    <p>{preview?.warning || error || (preview ? `${count} vendas disponíveis para revisão e emissão de notas. Vendas já faturadas em outro sistema podem ser marcadas para não duplicar.` : 'Consultando vendas passadas do AbacatePay…')}</p>
    <div className="past-sales-actions"><button type="button" className="app-secondary" onClick={onOpen}>Ver vendas sem nota</button><button type="button" className="text-button" onClick={onUpdateKey}>Atualizar key</button></div>
  </section>;
}
