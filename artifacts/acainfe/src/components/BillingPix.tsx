import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getBillingPayment, type BillingPayment } from '../lib/billing-payments';
import { trackPixPaid } from '../lib/analytics';
import { brl } from '../config/pricing';
import { CopyButton } from './CopyButton';
import { ApiError } from '../lib/api';

export const PIX_POLL_MS = 7500;
type Props = {
  base: string;
  payment: BillingPayment;
  onChange: (payment: BillingPayment) => void;
  onRefreshBalance: () => Promise<void>;
  onGenerate: () => void;
  generating: boolean;
  onUnauthorized: (error: unknown) => void;
};

export function BillingPix({ base, payment, onChange, onRefreshBalance, onGenerate, generating, onUnauthorized }: Props) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [refreshAttempt, setRefreshAttempt] = useState(0);
  const callbacks = useRef({ onChange, onRefreshBalance, onUnauthorized });
  callbacks.current = { onChange, onRefreshBalance, onUnauthorized };
  const mounted = useRef(false);
  const lock = useRef(false);
  const refreshed = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const check = useCallback(async () => {
    if (lock.current || !mounted.current || payment.status !== 'PENDING') return;
    lock.current = true; setChecking(true); setError('');
    try {
      const next = await getBillingPayment(base, payment.paymentId);
      if (!mounted.current) return;
      callbacks.current.onChange(next);
      return next.status;
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : 'Não foi possível verificar o Pix.');
        if (e instanceof ApiError && e.status === 401) callbacks.current.onUnauthorized(e);
      }
    } finally {
      lock.current = false;
      if (mounted.current) setChecking(false);
    }
  }, [base, payment.paymentId, payment.status]);

  useEffect(() => {
    if (payment.status !== 'PENDING') return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => { if (!stopped && !document.hidden) timer = setTimeout(poll, PIX_POLL_MS); };
    const poll = async () => {
      if (stopped || document.hidden) return;
      const status = await check();
      if (status !== 'PAID' && status !== 'EXPIRED') schedule();
    };
    const visibility = () => {
      clearTimeout(timer);
      if (!document.hidden) void poll();
    };
    schedule();
    document.addEventListener('visibilitychange', visibility);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [payment.status, check]);

  useEffect(() => {
    if (payment.status !== 'PAID') return;
    const record = () => trackPixPaid(payment);
    record();
    window.addEventListener('acainfe:analytics-consent', record);
    return () => window.removeEventListener('acainfe:analytics-consent', record);
  }, [payment]);

  useEffect(() => {
    if (payment.status !== 'PAID' || refreshed.current) return;
    refreshed.current = true;
    void callbacks.current.onRefreshBalance().catch(e => {
      if (mounted.current) {
        if (e instanceof ApiError && e.status === 401) callbacks.current.onUnauthorized(e);
        refreshed.current = false;
        setError('Pagamento confirmado, mas não foi possível atualizar o saldo.');
      }
    });
  }, [payment.status, refreshAttempt]);

  return <div className="pix-section">
    {payment.status === 'PAID' ? <>
      <h2 role="status">Pagamento confirmado</h2>
      <p>Recebemos {brl(payment.paidAmountCents!)} por Pix. Valores excedentes ficam como crédito.</p>
    </> : payment.status === 'EXPIRED' ? <>
      <h2 role="status">Este Pix expirou</h2>
      <p>Gere outro Pix para pagar seu saldo.</p>
      <button type="button" className="app-primary" disabled={generating} onClick={onGenerate}>Gerar outro Pix</button>
    </> : <>
      <h2>Pix de {brl(payment.amountCents)}</h2>
      {/^data:image\/(png|jpeg|webp);base64,/.test(payment.pixQrCodeImage) && <img src={payment.pixQrCodeImage} alt="QR Code para pagamento Pix" />}
      <p>Expira em {new Date(payment.expiresAt).toLocaleString('pt-BR')}</p>
      <div className="copy-field"><code>{payment.pixCopyPaste}</code><CopyButton text={payment.pixCopyPaste} /></div>
      <p aria-live="polite">{checking ? 'Verificando pagamento…' : 'Aguardando pagamento. Verificamos automaticamente enquanto esta tela estiver visível.'}</p>
      <button type="button" className="app-secondary" disabled={checking} onClick={() => void check()}>Verificar pagamento</button>
    </>}
    {error && <div className="app-alert" role="alert">{error}{payment.status === 'PAID' && <button type="button" onClick={() => { setError(''); setRefreshAttempt(n => n + 1); }}>Atualizar saldo</button>}</div>}
  </div>;
}
