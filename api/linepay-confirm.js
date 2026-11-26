// GET /api/linepay-confirm?transactionId=…&orderId=… — LINE Pay sends the buyer here after they approve.
import { redirect, loadOrder, saveOrder, linePayPost, originOf } from '../lib/shared.js';

export default async function handler(request) {
  const q = new URL(request.url).searchParams, base = originOf(request);
  const orderId = q.get('orderId'), transactionId = q.get('transactionId') || '';
  const order = await loadOrder(orderId);
  if (!order || !/^\d{10,25}$/.test(transactionId)) return redirect(`${base}/?payerror=notfound`);
  if (order.status === 'paid' || order.status === 'sent') return redirect(`${base}/?paid=${order.id}`); // refresh / double callback
  if (order.transactionId && order.transactionId !== transactionId) return redirect(`${base}/?payerror=mismatch`);

  const r = await linePayPost(`/v3/payments/${transactionId}/confirm`, { amount: order.amount, currency: 'TWD' });
  if (r.returnCode === '0000' || r.returnCode === '1172') { // 1172: already confirmed — treat as paid
    order.status = 'paid';
    order.paidAt = new Date().toISOString();
    order.transactionId = transactionId;
    await saveOrder(order);
    return redirect(`${base}/?paid=${order.id}`);
  }
  console.error('LINE Pay confirm failed', order.id, r.returnCode, r.returnMessage);
  order.status = 'draft'; order.lastError = `${r.returnCode} ${r.returnMessage || ''}`.trim();
  await saveOrder(order);
  return redirect(`${base}/?payerror=${encodeURIComponent(r.returnCode || 'unknown')}`);
}
