import test from 'node:test';
import assert from 'node:assert/strict';
import { getGatewayStatus, paymentState } from '../src/lib/midtrans.ts';
process.env.MIDTRANS_SERVER_KEY = 'synthetic-status-key';
const originalFetch = globalThis.fetch;
test('documented Midtrans 407 expiry is verified without accepting mismatched transactions or paid states', async () => {
  const status = { order_id: 'INV-SYNTHETIC', status_code: '407', gross_amount: '1000.00', currency: 'IDR', transaction_id: 'synthetic-reference', transaction_status: 'expire' };
  try {
    globalThis.fetch = async () => Response.json(status);
    const verified = await getGatewayStatus('INV-SYNTHETIC', 1000);
    assert.equal(paymentState(verified), 'failed');
    for (const change of [{ transaction_status: 'settlement' }, { transaction_status: 'pending' }, { gross_amount: '999.00' }, { order_id: 'OTHER' }, { currency: 'MYR' }, { transaction_id: '' }, { status_code: '401' }]) {
      globalThis.fetch = async () => Response.json({ ...status, ...change });
      await assert.rejects(getGatewayStatus('INV-SYNTHETIC', 1000), /GATEWAY_STATUS_UNVERIFIED/);
    }
  } finally { globalThis.fetch = originalFetch; }
});
