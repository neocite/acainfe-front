import { it } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedAppRoute } from '../server/app-routes';
import { parseBillingPayment } from '../src/lib/billing-payments';

const pending = {
  paymentId: 'pix-123', status: 'PENDING', currency: 'BRL', amountCents: 100,
  pixCopyPaste: 'fixture', pixQrCodeImage: '', expiresAt: '2030-01-01T12:00:00Z',
};

it('proxy libera apenas GET do pagamento individual, sem liberar outros métodos ou subrotas', () => {
  const path = '/companies/test-company/billing/payments/pix-123';
  assert.equal(isAllowedAppRoute('GET', path), true);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(isAllowedAppRoute(method, path), false);
  assert.equal(isAllowedAppRoute('GET', `${path}/secret`), false);
  assert.equal(isAllowedAppRoute('GET', '/companies/test-company/billing/payments'), false);
});
it('valida estados e identidade, permite valor efetivamente pago maior que o esperado', () => {
  assert.equal(parseBillingPayment(pending, 'pix-123').status, 'PENDING');
  assert.equal(parseBillingPayment({ ...pending, status: 'EXPIRED' }).status, 'EXPIRED');
  assert.equal(parseBillingPayment({ ...pending, status: 'PAID', paidAmountCents: 200 }).paidAmountCents, 200);
  assert.throws(() => parseBillingPayment(pending, 'another-payment'));
  for (const change of [
    { paymentId: undefined }, { status: 'UNKNOWN' }, { currency: 'USD' },
    { status: 'PAID' }, { status: 'PAID', paidAmountCents: 1.5 }, { amountCents: 0 },
    { expiresAt: 'invalid' },
  ]) assert.throws(() => parseBillingPayment({ ...pending, ...change }));
});
